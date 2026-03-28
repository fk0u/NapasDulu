mod database;
mod activity;

use database::{DbState, initialize_db};
use activity::start_activity_monitor;
use tauri::Manager;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // Prevent OS-level close operations like Alt+F4
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            let db_conn = initialize_db(&app).expect("Failed to initialize database");
            app.manage(DbState { conn: std::sync::Mutex::new(db_conn) });
            
            // Start Global Hook Activity Monitor
            start_activity_monitor(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::log_morning_diagnostic,
            commands::attempt_bypass,
            commands::quit_app,
            commands::get_active_time,
            commands::get_stats,
            commands::get_usage_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
