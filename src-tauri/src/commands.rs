use crate::database::DbState;
use chrono::Utc;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct CommandResponse {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn log_morning_diagnostic(
    sleep_hours: f32, 
    wake_hours: f32, 
    exercised: bool, 
    state: State<'_, DbState>
) -> CommandResponse {
    let conn = state.conn.lock().unwrap();
    let today = Utc::now().format("%Y-%m-%d").to_string();
    
    let res = conn.execute(
        "INSERT INTO diagnostics (date_logged, sleep_hours, wake_hours, exercised) 
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(date_logged) DO UPDATE SET
         sleep_hours=excluded.sleep_hours, wake_hours=excluded.wake_hours, exercised=excluded.exercised",
        rusqlite::params![today, sleep_hours, wake_hours, exercised],
    );

    match res {
        Ok(_) => CommandResponse { success: true, message: "Diagnostic logged.".into() },
        Err(e) => CommandResponse { success: false, message: e.to_string() }
    }
}

#[tauri::command]
pub fn attempt_bypass(state: State<'_, DbState>) -> CommandResponse {
    let conn = state.conn.lock().unwrap();
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let timestamp = Utc::now().to_rfc3339();

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM bypass_logs WHERE timestamp LIKE ?1",
        [format!("{}%", today)],
        |row| row.get(0),
    ).unwrap_or(0);

    if count >= 2 {
        return CommandResponse { success: false, message: "Limit bypass tercapai (2/2 hari ini). Hadapi realitas!".into() };
    }

    let _ = conn.execute(
        "INSERT INTO bypass_logs (timestamp, reason) VALUES (?1, 'Server on Fire')",
        [&timestamp],
    );
    CommandResponse { success: true, message: "Bypass granted. Get back to the fire.".into() }
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
