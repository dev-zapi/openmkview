use crate::errors::AppResult;
use crate::models::SystemSettings;
use rusqlite::Connection;

pub struct SettingsRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SettingsRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_system_settings(&self) -> AppResult<SystemSettings> {
        let settings_json: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?",
                ["system"],
                |row| row.get(0),
            )
            .ok();

        if let Some(json) = settings_json {
            if let Ok(settings) = serde_json::from_str::<SystemSettings>(&json) {
                return Ok(settings);
            }
        }

        Ok(SystemSettings::default())
    }

    pub fn save_system_settings(&self, settings: &SystemSettings) -> AppResult<()> {
        let json = serde_json::to_string(settings)?;

        self.conn.execute(
            "INSERT INTO settings (key, value, updated_at) 
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params!["system", json],
        )?;

        Ok(())
    }
}
