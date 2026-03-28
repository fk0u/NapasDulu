use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, CallNextHookEx, GetMessageW, WH_KEYBOARD_LL, WH_MOUSE_LL, HHOOK, MSG
};
use windows::Win32::Foundation::{WPARAM, LPARAM, LRESULT};
use tauri::{AppHandle, Emitter};

pub static LAST_ACTIVITY: AtomicU64 = AtomicU64::new(0);
pub static ACCUMULATED_ACTIVE_TIME: AtomicU64 = AtomicU64::new(0);

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
        } else {
            // Idle untuk > 5 menit, reset time akumulatif
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
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));
            
            let total_active = ACCUMULATED_ACTIVE_TIME.load(Ordering::Relaxed);
            
            // Limit = 90 menit (5400 detik)
            if total_active >= 5400 {
                let _ = app_handle.emit("trigger-lockdown", ());
                ACCUMULATED_ACTIVE_TIME.store(0, Ordering::Relaxed);
            } else if total_active >= 5340 {
                // Peringatan di menit ke-89
                let _ = app_handle.emit("trigger-warning", ());
            }
        }
    });
}
