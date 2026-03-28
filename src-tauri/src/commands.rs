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
pub fn attempt_bypass(phrase: String, state: State<'_, DbState>) -> CommandResponse {
    if phrase != "I sacrifice my physical health to bypass" {
        return CommandResponse { success: false, message: "Invalid override protocol.".into() };
    }

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
        "INSERT INTO bypass_logs (timestamp, reason) VALUES (?1, 'Protocol Override')",
        [&timestamp],
    );
    CommandResponse { success: true, message: "Bypass granted. Get back to the fire.".into() }
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn get_active_time() -> u64 {
    crate::activity::ACCUMULATED_ACTIVE_TIME.load(std::sync::atomic::Ordering::Relaxed)
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub active_time: u64,
    pub bypass_count: i32,
    pub sleep_hours: f32,
    pub exercised: bool,
}

#[tauri::command]
pub fn get_stats(state: State<'_, DbState>) -> StatsResponse {
    let conn = state.conn.lock().unwrap();
    let today = Utc::now().format("%Y-%m-%d").to_string();

    let bypass_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM bypass_logs WHERE timestamp LIKE ?1",
        [format!("{}%", today)],
        |row| row.get(0),
    ).unwrap_or(0);

    let (sleep_hours, exercised): (f32, bool) = conn.query_row(
        "SELECT sleep_hours, exercised FROM diagnostics WHERE date_logged = ?1 LIMIT 1",
        [today],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).unwrap_or((0.0, false));

    StatsResponse {
        active_time: crate::activity::ACCUMULATED_ACTIVE_TIME.load(std::sync::atomic::Ordering::Relaxed),
        bypass_count,
        sleep_hours,
        exercised,
    }
}

#[derive(Serialize)]
pub struct UsageDay {
    pub date: String,
    pub active_seconds: u64,
}

#[tauri::command]
pub fn get_usage_history(state: State<'_, DbState>) -> Vec<UsageDay> {
    let conn = state.conn.lock().unwrap();
    
    // Get the last 7 days of data ordered by date ASC
    let mut stmt = conn.prepare("SELECT date_logged, active_seconds FROM usage_history ORDER BY date_logged DESC LIMIT 7").unwrap();
    let iter = stmt.query_map([], |row| {
        Ok(UsageDay {
            date: row.get(0)?,
            active_seconds: row.get(1)?,
        })
    }).unwrap();

    let mut result: Vec<UsageDay> = Vec::new();
    for day in iter {
        if let Ok(d) = day {
            result.push(d);
        }
    }
    
    // Reverse to make it oldest to newest
    result.reverse();
    result
}
