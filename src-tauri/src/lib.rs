mod database;
mod activity;

use database::{DbState, initialize_db};
use activity::{start_activity_monitor, start_keyboard_hook};
use tauri::{Manager, menu::{Menu, MenuItem}, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}};
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // Hide instead of close, so we stay in the tray
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            let db_conn = initialize_db(&app).expect("Failed to initialize database");
            app.manage(DbState { conn: std::sync::Mutex::new(db_conn) });
            
            // Setup Tray Icon & Menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit (Bypass Only)", true, None::<&str>).unwrap();
            let show_i = MenuItem::with_id(app, "show", "Show Napas Dulu", true, None::<&str>).unwrap();
            let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();
            
            let tray_icon = app.default_window_icon().unwrap().clone();
            
            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            
            // Start Global Hook Activity Monitor
            start_activity_monitor(app.handle().clone());
            // Start Global Keyboard Hook for Anti-Bypass
            start_keyboard_hook();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::log_morning_diagnostic,
            commands::attempt_bypass,
            commands::quit_app,
            commands::get_active_time,
            commands::get_stats,
            commands::get_usage_history,
            commands::get_app_usage_stats,
            commands::set_dynamic_limit,
            commands::start_scheduler,
            commands::stop_scheduler,
            commands::set_lockdown_state,
            commands::get_monitors,
            commands::simulate_lockdown,
            commands::get_predictive_score
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
