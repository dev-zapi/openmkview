use crate::errors::{AppError, AppResult};
use crate::models::ToolSession;
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};

/// Tool Session tokens are only ever persisted hashed so a leaked database
/// cannot be replayed as a credential.
pub fn hash_tool_session_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub struct ToolSessionRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ToolSessionRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    fn hydrate(row: &rusqlite::Row<'_>) -> rusqlite::Result<ToolSession> {
        Ok(ToolSession {
            id: row.get(0)?,
            label: row.get(1)?,
            created_at: row.get(2)?,
            last_used_at: row.get(3)?,
        })
    }

    pub fn create(&self, token_hash: &str, label: &str) -> AppResult<ToolSession> {
        self.conn.execute(
            "INSERT INTO tool_sessions (token_hash, label) VALUES (?, ?)",
            params![token_hash, label],
        )?;
        let id = self.conn.last_insert_rowid();
        self.find_by_id(id)?
            .ok_or_else(|| AppError::InternalError("tool session insert failed".to_string()))
    }

    pub fn list(&self) -> AppResult<Vec<ToolSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, label, created_at, last_used_at
             FROM tool_sessions ORDER BY created_at DESC, id DESC",
        )?;
        let sessions = stmt.query_map([], Self::hydrate)?;
        Ok(sessions.filter_map(|row| row.ok()).collect())
    }

    pub fn find_by_id(&self, id: i64) -> AppResult<Option<ToolSession>> {
        let session = self.conn.query_row(
            "SELECT id, label, created_at, last_used_at
             FROM tool_sessions WHERE id = ?",
            [id],
            Self::hydrate,
        );

        match session {
            Ok(session) => Ok(Some(session)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(err) => Err(err.into()),
        }
    }

    pub fn find_by_token_hash(&self, token_hash: &str) -> AppResult<Option<ToolSession>> {
        let session = self.conn.query_row(
            "SELECT id, label, created_at, last_used_at
             FROM tool_sessions WHERE token_hash = ?",
            [token_hash],
            Self::hydrate,
        );

        match session {
            Ok(session) => Ok(Some(session)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(err) => Err(err.into()),
        }
    }

    pub fn touch_last_used(&self, id: i64) -> AppResult<()> {
        self.conn.execute(
            "UPDATE tool_sessions SET last_used_at = datetime('now') WHERE id = ?",
            [id],
        )?;
        Ok(())
    }

    pub fn delete(&self, id: i64) -> AppResult<bool> {
        let deleted = self
            .conn
            .execute("DELETE FROM tool_sessions WHERE id = ?", [id])?;
        Ok(deleted > 0)
    }
}
