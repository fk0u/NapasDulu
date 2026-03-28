use rusqlite::{Connection, Result};
use std::sync::Mutex;
use std::fs;
use tauri::Manager;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn initialize_db(app: &tauri::App) -> Result<Connection> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("./"));
    
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).unwrap();
    }
    
    let db_path = app_data_dir.join("napas_dulu.sqlite");
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS diagnostics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_logged TEXT NOT NULL UNIQUE,
            sleep_hours REAL NOT NULL,
            wake_hours REAL NOT NULL,
            exercised BOOLEAN NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS bypass_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            reason TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS usage_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_logged TEXT NOT NULL UNIQUE,
            active_seconds INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    Ok(conn)
}
