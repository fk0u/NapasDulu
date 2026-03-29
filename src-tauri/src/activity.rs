use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use chrono::Utc;

pub static ACCUMULATED_ACTIVE_TIME: AtomicU64 = AtomicU64::new(0);
pub static DAILY_ACTIVE_TIME: AtomicU64 = AtomicU64::new(0);
pub static SESSION_LIMIT_SECONDS: AtomicU64 = AtomicU64::new(5400); // Changed to dynamic

pub struct SchedulerState {
    pub is_running: bool,
}

lazy_static! {
    pub static ref SCHEDULER: Arc<(Mutex<SchedulerState>, Condvar)> = Arc::new((
        Mutex::new(SchedulerState { is_running: true }),
        Condvar::new()
    ));
}

pub fn start_activity_monitor(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut current_date = Utc::now().format("%Y-%m-%d").to_string();
        
        // --- INITIAL LOAD FOR TODAY ---
        {
            if let Ok(conn) = app_handle.state::<crate::database::DbState>().conn.lock() {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO usage_history (date_logged, active_seconds) VALUES (?1, 0)",
                    [&current_date],
                );

                if DAILY_ACTIVE_TIME.load(Ordering::Relaxed) == 0 {
                    let saved_secs: u64 = conn
                        .query_row(
                            "SELECT active_seconds FROM usage_history WHERE date_logged = ?1",
                            [&current_date],
                            |row| row.get(0),
                        )
                        .unwrap_or(0);
                    DAILY_ACTIVE_TIME.store(saved_secs, Ordering::Relaxed);
                }
            }
        }

        let mut app_usage_buffer: HashMap<String, u64> = HashMap::new();
        let mut loop_counter = 0;

        loop {
            // SCHEDULER LOGIC (Condvar-based for efficiency and immediate pause/resume)
            {
                let lock_and_cvar = &*SCHEDULER;
                let (lock, cvar) = &**lock_and_cvar;
                
                let mut state = match lock.lock() {
                    Ok(s) => s,
                    Err(poisoned) => poisoned.into_inner(),
                };

                while !state.is_running {
                    state = cvar.wait(state).unwrap();
                }

                let (new_state, _timeout_res) = cvar
                    .wait_timeout(state, std::time::Duration::from_secs(10))
                    .unwrap();

                state = new_state;

                if !state.is_running {
                    continue;
                }
            }

            let mut is_idle = false;
            unsafe {
                use windows::Win32::System::SystemInformation::GetTickCount;
                use windows::Win32::UI::Input::KeyboardAndMouse::{
                    GetLastInputInfo, LASTINPUTINFO,
                };

                let mut last_input = LASTINPUTINFO {
                    cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                    dwTime: 0,
                };

                if GetLastInputInfo(&mut last_input).as_bool() {
                    let tick = GetTickCount(); 
                    let idle_ms = tick.wrapping_sub(last_input.dwTime);
                    if idle_ms > 300_000 {
                        is_idle = true;
                    }
                }
            }

            if is_idle {
                ACCUMULATED_ACTIVE_TIME.store(0, Ordering::Relaxed);
                continue;
            }

            // Midnight Crossover Handling (Reset daily stats if day changed)
            let today = Utc::now().format("%Y-%m-%d").to_string();
            if today != current_date {
                println!("Midnight Rollover Detected: {} -> {}", current_date, today);
                current_date = today.clone();
                DAILY_ACTIVE_TIME.store(0, Ordering::Relaxed);
                
                // Initialize new day in DB
                if let Ok(conn) = app_handle.state::<crate::database::DbState>().conn.lock() {
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO usage_history (date_logged, active_seconds) VALUES (?1, 0)",
                        [&current_date],
                    );
                }
            }

            // User is active! Add 10 seconds.
            let total_active = ACCUMULATED_ACTIVE_TIME.fetch_add(10, Ordering::Relaxed) + 10;
            let daily_active = DAILY_ACTIVE_TIME.fetch_add(10, Ordering::Relaxed) + 10;

            let mut active_app_name = String::from("Unknown");

            // Track Foreground Application Wakatime-style safely
            unsafe {
                use windows::Win32::Foundation::{CloseHandle, HWND};
                use windows::Win32::System::Threading::{
                    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                    PROCESS_QUERY_LIMITED_INFORMATION,
                };
                use windows::Win32::UI::WindowsAndMessaging::{
                    GetForegroundWindow, GetWindowThreadProcessId,
                };

                let hwnd: HWND = GetForegroundWindow();
                if hwnd.0 != std::ptr::null_mut() {
                    let mut pid: u32 = 0;
                    GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
                    if pid > 0 {
                        if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                            let mut buffer: [u16; 1024] = [0; 1024];
                            let mut size = buffer.len() as u32;
                            if QueryFullProcessImageNameW(
                                handle,
                                PROCESS_NAME_WIN32,
                                windows::core::PWSTR::from_raw(buffer.as_mut_ptr()),
                                &mut size,
                            )
                            .is_ok()
                            {
                                let path = String::from_utf16_lossy(&buffer[..size as usize]);
                                active_app_name = std::path::Path::new(&path)
                                    .file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .to_string();
                            }
                            let _ = CloseHandle(handle);
                        }
                    }
                }
            }

            if active_app_name != "Unknown" {
                *app_usage_buffer.entry(active_app_name).or_insert(0) += 10;
            }

            loop_counter += 1;

            // --- DATABASE FLUSH EVERY 60 SECONDS (6 loops of 10s) ---
            if loop_counter >= 6 {
                if let Ok(conn) = app_handle.state::<crate::database::DbState>().conn.lock() {
                    let _ = conn.execute(
                        "UPDATE usage_history SET active_seconds = ?1 WHERE date_logged = ?2",
                        rusqlite::params![daily_active, current_date],
                    );

                    // Batch write app usage
                    for (app, secs) in &app_usage_buffer {
                        let _ = conn.execute(
                            "INSERT INTO app_usage_history (date_logged, app_name, active_seconds) 
                             VALUES (?1, ?2, ?3) 
                             ON CONFLICT(date_logged, app_name) DO UPDATE SET active_seconds = active_seconds + ?3",
                            rusqlite::params![current_date, app, secs],
                        );
                    }
                }
                app_usage_buffer.clear();
                loop_counter = 0;
            }

            // --- THRESHOLD VALIDATION ---
            let limit = SESSION_LIMIT_SECONDS.load(Ordering::Relaxed);
            let warning_limit = limit.saturating_sub(60); 

            if total_active >= limit {
                let _ = app_handle.emit("trigger-lockdown", ());
                ACCUMULATED_ACTIVE_TIME.store(0, Ordering::Relaxed); 
            } else if total_active >= warning_limit && total_active < limit {
                let _ = app_handle.emit("trigger-warning", ());
            }
        }
    });
}