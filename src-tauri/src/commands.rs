use crate::database::DbState;
use chrono::Utc;
use serde::Serialize;
use tauri::State;
use std::sync::atomic::Ordering;

#[derive(Serialize)]
pub struct AppUsageStat {
    pub app_name: String,
    pub active_seconds: u64,
}

#[derive(Serialize)]
pub struct CommandResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Serialize)]
pub struct PredictiveScore {
    pub apm: u64,
    pub frustration_level: u64,
}

#[tauri::command]
pub fn get_predictive_score() -> PredictiveScore {
    let actions = crate::activity::TOTAL_KEY_ACTIONS.swap(0, Ordering::Relaxed);
    let frustrated = crate::activity::BACKSPACE_DELETES.swap(0, Ordering::Relaxed);
    
    // Calculate frustration (0-100) based on ratio of backspaces to total actions
    // Assume 15% backspaces is "frustrated"
    let frustration = if actions > 0 {
        ((frustrated as f64 / actions as f64) * 100.0 * 6.6).min(100.0) as u64
    } else {
        0
    };

    PredictiveScore {
        apm: actions, // Actions in the last interval (1 min if polled every min)
        frustration_level: frustration,
    }
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
pub fn attempt_bypass(logs: String, state: State<'_, DbState>) -> CommandResponse {
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
        "INSERT INTO bypass_logs (timestamp, reason) VALUES (?1, ?2)",
        rusqlite::params![timestamp, logs],
    );
    CommandResponse { success: true, message: "Bypass granted. Get back to the fire.".into() }
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn set_dynamic_limit(limit_seconds: u64) -> Result<(), String> {
    crate::activity::SESSION_LIMIT_SECONDS.store(limit_seconds, Ordering::Relaxed);
    println!("Dynamic system limit set to: {} seconds", limit_seconds);
    Ok(())
}

#[tauri::command]
pub fn start_scheduler() {
    let lock_and_cvar = &*crate::activity::SCHEDULER;
    let (lock, cvar) = &**lock_and_cvar;
    let mut state = lock.lock().unwrap();
    state.is_running = true;
    cvar.notify_all(); // Wake the sleep loop instantly so it tracks time again
    println!("Backend Timer Scheduler STARTED.");
}

#[tauri::command]
pub fn stop_scheduler() {
    let lock_and_cvar = &*crate::activity::SCHEDULER;
    let (lock, cvar) = &**lock_and_cvar;
    let mut state = lock.lock().unwrap();
    state.is_running = false;
    cvar.notify_all(); // Wake the waiting sleep loop so it immediately loops and gets stuck in while !is_running
    println!("Backend Timer Scheduler PAUSED/STOPPED.");
}

#[tauri::command]
pub fn set_lockdown_state(active: bool) {
    crate::activity::LOCKDOWN_ACTIVE.store(active, Ordering::Relaxed);
    println!("Lockdown state set to: {}", active);
}

#[derive(Serialize)]
pub struct MonitorInfo {
    pub name: Option<String>,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_monitors() -> Vec<MonitorInfo> {
    Vec::new() // Placeholder to fix build errors
}

#[tauri::command]
pub fn get_active_time() -> u64 {
    crate::activity::ACCUMULATED_ACTIVE_TIME.load(Ordering::Relaxed)
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub active_time: u64,
    pub session_limit: u64,
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
        active_time: crate::activity::ACCUMULATED_ACTIVE_TIME.load(Ordering::Relaxed),
        session_limit: crate::activity::SESSION_LIMIT_SECONDS.load(Ordering::Relaxed),
        bypass_count,
        sleep_hours,
        exercised,
    }
}

#[tauri::command]
pub fn simulate_lockdown(app: tauri::AppHandle) {
    use tauri::Emitter;
    let _ = app.emit("trigger-lockdown", ());
    println!("Simulation: Force triggering lockdown event.");
}

#[derive(Serialize)]
pub struct UsageDay {
    pub date: String,
    pub active_seconds: u64,
}

#[tauri::command]
pub fn get_app_usage_stats(state: tauri::State<'_, crate::database::DbState>) -> Result<Vec<AppUsageStat>, String> {
    let conn = state.conn.lock().unwrap();
    let today = Utc::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare("SELECT app_name, active_seconds FROM app_usage_history WHERE date_logged = ?1 ORDER BY active_seconds DESC LIMIT 20")
        .map_err(|e| e.to_string())?;

    let stat_iter = stmt
        .query_map([&today], |row| {
            Ok(AppUsageStat {
                app_name: row.get(0)?,
                active_seconds: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut stats = Vec::new();
    for stat in stat_iter {
        stats.push(stat.map_err(|e| e.to_string())?);
    }
    Ok(stats)
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
