use crate::errors::{AppError, AppResult};
use crate::models::Project;
use rusqlite::Connection;

pub struct ProjectRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ProjectRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list(&self, open_only: bool) -> AppResult<Vec<Project>> {
        let query = if open_only {
            "SELECT id, path, name, created_at, last_opened_at, is_open, color, icon 
             FROM projects WHERE is_open = 1 ORDER BY last_opened_at DESC"
        } else {
            "SELECT id, path, name, created_at, last_opened_at, is_open, color, icon 
             FROM projects ORDER BY last_opened_at DESC"
        };

        let mut stmt = self.conn.prepare(query)?;
        let projects = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                last_opened_at: row.get(4)?,
                is_open: row.get::<_, i32>(5)? != 0,
                color: row.get(6)?,
                icon: row.get(7)?,
            })
        })?;

        Ok(projects.filter_map(|r| r.ok()).collect())
    }

    pub fn find_by_id(&self, id: i64) -> AppResult<Option<Project>> {
        let project = self.conn.query_row(
            "SELECT id, path, name, created_at, last_opened_at, is_open, color, icon FROM projects WHERE id = ?",
            [id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    last_opened_at: row.get(4)?,
                    is_open: row.get::<_, i32>(5)? != 0,
                    color: row.get(6)?,
                    icon: row.get(7)?,
                })
            },
        );

        match project {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn find_by_path(&self, path: &str) -> AppResult<Option<Project>> {
        let project = self.conn.query_row(
            "SELECT id, path, name, created_at, last_opened_at, is_open, color, icon FROM projects WHERE path = ?",
            [path],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    last_opened_at: row.get(4)?,
                    is_open: row.get::<_, i32>(5)? != 0,
                    color: row.get(6)?,
                    icon: row.get(7)?,
                })
            },
        );

        match project {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn create(&self, path: &str, name: &str) -> AppResult<Project> {
        self.conn.execute(
            "INSERT INTO projects (path, name, is_open) VALUES (?, ?, 1)",
            (path, name),
        )?;

        let id = self.conn.last_insert_rowid();
        self.find_by_id(id).and_then(|p| {
            p.ok_or_else(|| AppError::InternalError("Cannot find project after creation".into()))
        })
    }

    pub fn update_open_status(&self, id: i64, is_open: bool) -> AppResult<bool> {
        let rows = self.conn.execute(
            "UPDATE projects SET is_open = ?, last_opened_at = datetime('now') WHERE id = ?",
            (is_open, id),
        )?;
        Ok(rows > 0)
    }

    pub fn get_path(&self, id: i64) -> AppResult<String> {
        self.conn
            .query_row("SELECT path FROM projects WHERE id = ?", [id], |row| {
                row.get(0)
            })
            .map_err(|e| e.into())
    }

    /// Get recently opened projects (max limit items)
    pub fn get_recent_projects(&self, limit: i64) -> AppResult<Vec<Project>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, name, created_at, last_opened_at, is_open, color, icon 
             FROM projects 
             ORDER BY last_opened_at DESC 
             LIMIT ?",
        )?;

        let projects = stmt.query_map([limit], |row| {
            Ok(Project {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                last_opened_at: row.get(4)?,
                is_open: row.get::<_, i32>(5)? != 0,
                color: row.get(6)?,
                icon: row.get(7)?,
            })
        })?;

        Ok(projects.filter_map(|r| r.ok()).collect())
    }

    pub fn update_color(&self, id: i64, color: &str) -> AppResult<bool> {
        let rows = self
            .conn
            .execute("UPDATE projects SET color = ? WHERE id = ?", (color, id))?;
        Ok(rows > 0)
    }

    pub fn update_project(
        &self,
        id: i64,
        name: Option<&str>,
        color: Option<&str>,
        icon: Option<&str>,
    ) -> AppResult<bool> {
        let mut updates = Vec::new();

        if name.is_some() {
            updates.push("name = ?");
        }
        if color.is_some() {
            updates.push("color = ?");
        }
        if icon.is_some() {
            updates.push("icon = ?");
        }

        if updates.is_empty() {
            return Ok(false);
        }

        let query = format!("UPDATE projects SET {} WHERE id = ?", updates.join(", "));

        let rows = match (name, color, icon) {
            (Some(n), Some(c), Some(i)) => {
                self.conn.execute(&query, rusqlite::params![n, c, i, id])?
            }
            (Some(n), Some(c), None) => self.conn.execute(&query, rusqlite::params![n, c, id])?,
            (Some(n), None, Some(i)) => self.conn.execute(&query, rusqlite::params![n, i, id])?,
            (Some(n), None, None) => self.conn.execute(&query, rusqlite::params![n, id])?,
            (None, Some(c), Some(i)) => self.conn.execute(&query, rusqlite::params![c, i, id])?,
            (None, Some(c), None) => self.conn.execute(&query, rusqlite::params![c, id])?,
            (None, None, Some(i)) => self.conn.execute(&query, rusqlite::params![i, id])?,
            (None, None, None) => 0,
        };

        Ok(rows > 0)
    }
}
