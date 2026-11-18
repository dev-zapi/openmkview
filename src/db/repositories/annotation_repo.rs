use crate::errors::{AppError, AppResult};
use crate::models::{Annotation, AnnotationNote};
use rusqlite::{params, Connection, Row};

pub struct AnnotationRepository<'a> {
    conn: &'a Connection,
}

struct AnnotationRow {
    id: i64,
    project_id: i64,
    relative_path: String,
    anchor_json: String,
    snapshot: Option<String>,
    is_resolved: i64,
    created_at: String,
    updated_at: String,
}

impl AnnotationRow {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            project_id: row.get(1)?,
            relative_path: row.get(2)?,
            anchor_json: row.get(3)?,
            snapshot: row.get(4)?,
            is_resolved: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    }
}

impl<'a> AnnotationRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(
        &self,
        project_id: i64,
        relative_path: &str,
        anchor_json: &str,
        snapshot: Option<&str>,
        body: &str,
    ) -> AppResult<Annotation> {
        self.conn.execute(
            "INSERT INTO annotations (project_id, relative_path, anchor_json, snapshot)
             VALUES (?, ?, ?, ?)",
            params![project_id, relative_path, anchor_json, snapshot],
        )?;

        let annotation_id = self.conn.last_insert_rowid();

        self.conn.execute(
            "INSERT INTO annotation_notes (annotation_id, body) VALUES (?, ?)",
            params![annotation_id, body],
        )?;

        self.find_by_id(annotation_id)?
            .ok_or_else(|| AppError::InternalError("Cannot find annotation after creation".into()))
    }

    pub fn list_for_file(
        &self,
        project_id: i64,
        relative_path: &str,
    ) -> AppResult<Vec<Annotation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, relative_path, anchor_json, snapshot, is_resolved, created_at, updated_at
             FROM annotations
             WHERE project_id = ? AND relative_path = ?
             ORDER BY created_at ASC, id ASC",
        )?;

        let rows = stmt.query_map(params![project_id, relative_path], AnnotationRow::from_row)?;

        let mut annotations = Vec::new();
        for row in rows {
            annotations.push(self.hydrate(row?)?);
        }

        Ok(annotations)
    }

    pub fn find_by_id(&self, id: i64) -> AppResult<Option<Annotation>> {
        let row = self.conn.query_row(
            "SELECT id, project_id, relative_path, anchor_json, snapshot, is_resolved, created_at, updated_at
             FROM annotations WHERE id = ?",
            [id],
            AnnotationRow::from_row,
        );

        match row {
            Ok(row) => Ok(Some(self.hydrate(row)?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    pub fn delete(&self, id: i64) -> AppResult<bool> {
        let rows = self
            .conn
            .execute("DELETE FROM annotations WHERE id = ?", [id])?;
        Ok(rows > 0)
    }

    /// Replace an annotation's Anchor payload and snapshot in one write.
    ///
    /// Returns `None` when the annotation does not exist so the service can
    /// map it to NotFound instead of silently creating a row.
    pub fn update_anchor(
        &self,
        id: i64,
        anchor_json: &str,
        snapshot: Option<&str>,
    ) -> AppResult<Option<Annotation>> {
        let rows = self.conn.execute(
            "UPDATE annotations
             SET anchor_json = ?, snapshot = ?, updated_at = datetime('now')
             WHERE id = ?",
            params![anchor_json, snapshot, id],
        )?;

        if rows == 0 {
            return Ok(None);
        }

        self.find_by_id(id)
    }

    /// Rewrite stored paths after an in-app rename or move.
    ///
    /// A file/directory renamed to `to` moves every row anchored exactly at
    /// `from` plus every descendant below it. Prefixes are segment-aware:
    /// moving `docs` must not touch `docs-other`. Rows are selected by project
    /// and filtered in Rust so paths containing `%` or `_` cannot miscarry.
    pub fn move_paths(&self, project_id: i64, from: &str, to: &str) -> AppResult<usize> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, relative_path FROM annotations WHERE project_id = ?")?;
        let rows = stmt.query_map([project_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let descendant_prefix = format!("{}/", from);
        let mut updates = Vec::new();
        for row in rows {
            let (id, relative_path) = row?;
            let new_path = if relative_path == from {
                to.to_string()
            } else if relative_path.starts_with(&descendant_prefix) {
                format!("{}{}", to, &relative_path[from.len()..])
            } else {
                continue;
            };
            updates.push((id, new_path));
        }
        drop(stmt);

        let mut moved = 0;
        for (id, new_path) in updates {
            moved += self.conn.execute(
                "UPDATE annotations SET relative_path = ?, updated_at = datetime('now')
                 WHERE id = ?",
                params![new_path, id],
            )?;
        }
        Ok(moved)
    }

    /// Appends a Reply to an existing thread and returns the hydrated annotation.
    pub fn append_note(&self, annotation_id: i64, body: &str) -> AppResult<Option<Annotation>> {
        if self.find_by_id(annotation_id)?.is_none() {
            return Ok(None);
        }

        self.conn.execute(
            "INSERT INTO annotation_notes (annotation_id, body) VALUES (?, ?)",
            params![annotation_id, body],
        )?;
        self.touch(annotation_id)?;

        self.find_by_id(annotation_id)
    }

    /// Edits one note in a thread. Returns false when the note does not belong
    /// to the annotation or does not exist.
    pub fn update_note(&self, annotation_id: i64, note_id: i64, body: &str) -> AppResult<bool> {
        let rows = self.conn.execute(
            "UPDATE annotation_notes SET body = ? WHERE id = ? AND annotation_id = ?",
            params![body, note_id, annotation_id],
        )?;

        if rows > 0 {
            self.touch(annotation_id)?;
        }

        Ok(rows > 0)
    }

    /// Sets the thread-level Resolved flag. Returns false for an unknown id.
    pub fn set_resolved(&self, id: i64, resolved: bool) -> AppResult<bool> {
        let rows = self.conn.execute(
            "UPDATE annotations
             SET is_resolved = ?, updated_at = datetime('now')
             WHERE id = ?",
            params![resolved as i64, id],
        )?;
        Ok(rows > 0)
    }

    fn touch(&self, annotation_id: i64) -> AppResult<()> {
        self.conn.execute(
            "UPDATE annotations SET updated_at = datetime('now') WHERE id = ?",
            [annotation_id],
        )?;
        Ok(())
    }

    fn hydrate(&self, row: AnnotationRow) -> AppResult<Annotation> {
        let anchor = serde_json::from_str(&row.anchor_json)?;

        Ok(Annotation {
            id: row.id,
            project_id: row.project_id,
            relative_path: row.relative_path,
            anchor,
            snapshot: row.snapshot,
            resolved: row.is_resolved != 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            notes: self.load_notes(row.id)?,
        })
    }

    fn load_notes(&self, annotation_id: i64) -> AppResult<Vec<AnnotationNote>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, annotation_id, body, created_at
             FROM annotation_notes
             WHERE annotation_id = ?
             ORDER BY created_at ASC, id ASC",
        )?;

        let notes = stmt.query_map([annotation_id], |row| {
            Ok(AnnotationNote {
                id: row.get(0)?,
                annotation_id: row.get(1)?,
                body: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        Ok(notes.filter_map(|note| note.ok()).collect())
    }
}
