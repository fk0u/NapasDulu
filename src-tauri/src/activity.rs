use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::{Arc, Mutex, Condvar};
use lazy_static::lazy_static;
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, CallNextHookEx, GetMessageW, WH_KEYBOARD_LL, WH_MOUSE_LL, HHOOK, MSG
};
use windows::Win32::Foundation::{WPARAM, LPARAM, LRESULT};
use tauri::{AppHandle, Emitter};

pub static LAST_ACTIVITY: AtomicU64 = AtomicU64::new(0);
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

fn update_activity() {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let last = LAST_ACTIVITY.load(Ordering::Relaxed);
    
    // Throttle atomic updates to max 1 per second
    if now == last {
        return;
    }
    
    LAST_ACTIVITY.store(now, Ordering::Relaxed);

    if last > 0 {
        let delta = now.saturating_sub(last);
        if delta < 300 { 
            // Tambahkan durasi jika idle kurang dari 5 menit
            ACCUMULATED_ACTIVE_TIME.fetch_add(delta, Ordering::Relaxed);
            DAILY_ACTIVE_TIME.fetch_add(delta, Ordering::Relaxed);
        } else {
            // Idle untuk > 5 menit, reset time akumulatif sesi
            ACCUMULATED_ACTIVE_TIME.store(0, Ordering::Relaxed);
        }
    }
}

extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 { update_activity(); }
    unsafe { CallNextHookEx(HHOOK::default(), code, wparam, lparam) }
}

extern "system" fn mouse_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 { update_activity(); }
    unsafe { CallNextHookEx(HHOOK::default(), code, wparam, lparam) }
}

pub fn start_activity_monitor(app_handle: AppHandle) {
    // Thread for OS Windows Hook
    std::thread::spawn(move || {
        unsafe {
            let _k_hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), None, 0).unwrap();
            let _m_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), None, 0).unwrap();
            
            // Loop khusus yang dibutuhkan hook intercept agar state persist di background
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                // message loop
            }
        }
    });

    // Thread for Threshold validation
    std::thread::spawn(move || {
        use tauri::Manager;
        use chrono::Utc;
        
        loop {
            // INITIAL LOAD FOR TODAY
            {
                let state = app_handle.state::<crate::database::DbState>();
                let conn = state.conn.lock().unwrap();
                let today = Utc::now().format("%Y-%m-%d").to_string();
                
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO usage_history (date_logged, active_seconds) VALUES (?1, 0)",
                    [&today],
                );
                
                if DAILY_ACTIVE_TIME.load(Ordering::Relaxed) == 0 {
                    let saved_secs: u64 = conn.query_row(
                        "SELECT active_seconds FROM usage_history WHERE date_logged = ?1",
                        [&today],
                        |row| row.get(0),
                    ).unwrap_or(0);
                    DAILY_ACTIVE_TIME.store(saved_secs, Ordering::Relaxed);
                }
            }

            loop {
                // SCHEDULER LOGIC (Condvar-based for efficiency and immediate pause/resume)
                {
                    let lock_and_cvar = &*SCHEDULER;
                    let (lock, cvar) = &**lock_and_cvar;
                    let mut state = lock.lock().unwrap();
                    
                    // 1. Jika OFF, thread akan idle secara absolut, CPU usage = 0% di blok wait()
                    while !state.is_running {
                        state = cvar.wait(state).unwrap(); 
                    }
                    
                    // 2. Jika ON, kita tunggu 10 detik atau hingga ada trigger stop (notify_all)
                    let (new_state, _timeout_res) = cvar.wait_timeout(
                        state, 
                        std::time::Duration::from_secs(10)
                    ).unwrap();
                    
                    state = new_state;

                    // Jika saat menunggu ternyata state di-ubah menjadi OFF, kita lompati validasi
                    if !state.is_running {
                        continue; 
                    }
                }

                // state is automatically dropped here when the block closes

                let mut is_idle = false;
                unsafe {
                    use windows::Win32::System::SystemInformation::GetTickCount;
                    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
                    
                    let mut last_input = LASTINPUTINFO {
                        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                        dwTime: 0,
                    };
                    
                    if GetLastInputInfo(&mut last_input).is_ok() {
                        let tick = GetTickCount(); // tick is u32
                        // Handle u32 wrap-around
                        let idle_ms = tick.wrapping_sub(last_input.dwTime);
                        if idle_ms > 300_000 { // 5 minutes (300,000 milidetik)
                            is_idle = true;
                        }
                    }
                }

                if is_idle {
                    println!("User is IDLE (no IO for 5m). Skipping activity tracking.");
                    continue;
                }

                let mut active_app_name = String::from("Unknown");
                
                // Track Foreground Application Wakatime-style
                unsafe {
                    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
                    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW, PROCESS_NAME_WIN32};
                    use windows::Win32::Foundation::CloseHandle;
                    
                    let hwnd = GetForegroundWindow();
                    if hwnd.0 != std::ptr::null_mut() {
                        let mut pid: u32 = 0;
                        GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
                        if pid > 0 {
                            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                                let mut buffer: [u16; 1024] = [0; 1024];
                                let mut size = buffer.len() as u32;
                                if QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, windows::core::PWSTR::from_raw(buffer.as_mut_ptr()), &mut size).is_ok() {
                                    let path = String::from_utf16_lossy(&buffer[..size as usize]);
                                    active_app_name = std::path::Path::new(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
                                }
                                let _ = CloseHandle(handle);
                            }
                        }
                    }
                }

                let total_active = ACCUMULATED_ACTIVE_TIME.load(Ordering::Relaxed);
                let daily_active = DAILY_ACTIVE_TIME.load(Ordering::Relaxed);
                
                // Save daily_active to DB
                {
                    let state = app_handle.state::<crate::database::DbState>();
                    let conn = state.conn.lock().unwrap();
                    let today = Utc::now().format("%Y-%m-%d").to_string();
                    let _ = conn.execute(
                        "UPDATE usage_history SET active_seconds = ?1 WHERE date_logged = ?2",
                        rusqlite::params![daily_active, today],
                    );
                    
                    if active_app_name != "Unknown" {
                        let _ = conn.execute(
                            "INSERT INTO app_usage_history (date_logged, app_name, active_seconds) 
                             VALUES (?1, ?2, 10) 
                             ON CONFLICT(date_logged, app_name) DO UPDATE SET active_seconds = active_seconds + 10",
                            rusqlite::params![today, active_app_name],
                        );
                    }
                }
                
                let limit = SESSION_LIMIT_SECONDS.load(Ordering::Relaxed);
                let warning_limit = limit.saturating_sub(60); // Peringatan 1 menit sebelum

                // Limit = Dynamic for SINGLE SESSION
                if total_active >= limit {
                    let _ = app_handle.emit("trigger-lockdown", ());
                    ACCUMULATED_ACTIVE_TIME.store(0, Ordering::Relaxed); // reset only the session
                } else if total_active >= warning_limit && total_active < limit {
                    // Peringatan di 60 detik terakhir
                    let _ = app_handle.emit("trigger-warning", ());
                }
            }
        }
    });
}
