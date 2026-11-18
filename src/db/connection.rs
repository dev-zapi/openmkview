use rusqlite::Connection;
use std::path::Path;

pub fn init_db(db_path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA foreign_keys = ON")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
            is_open INTEGER NOT NULL DEFAULT 1,
            color TEXT NULL DEFAULT NULL,
            icon TEXT NULL DEFAULT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            relative_path TEXT NOT NULL,
            anchor_json TEXT NOT NULL,
            snapshot TEXT NULL DEFAULT NULL,
            is_resolved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS annotation_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            author TEXT NULL DEFAULT NULL,
            is_agent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_annotations_project_path
            ON annotations(project_id, relative_path);
        CREATE INDEX IF NOT EXISTS idx_annotation_notes_annotation
            ON annotation_notes(annotation_id, created_at, id);",
    )?;

    // Migration: Add color column if it doesn't exist
    let color_column_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name='color'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !color_column_exists {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN color TEXT NULL DEFAULT NULL",
            [],
        )?;
    }

    // Migration: Add icon column if it doesn't exist
    let icon_column_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name='icon'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !icon_column_exists {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN icon TEXT NULL DEFAULT NULL",
            [],
        )?;
    }

    // Migration: Add author column if it doesn't exist
    let author_column_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('annotation_notes') WHERE name='author'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !author_column_exists {
        conn.execute(
            "ALTER TABLE annotation_notes ADD COLUMN author TEXT NULL DEFAULT NULL",
            [],
        )?;
    }

    // Migration: Add is_agent flag if it doesn't exist. Existing notes predate
    // authorship and backfill to 0 (human/no author).
    let is_agent_column_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('annotation_notes') WHERE name='is_agent'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !is_agent_column_exists {
        conn.execute(
            "ALTER TABLE annotation_notes ADD COLUMN is_agent INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::init_db;
    use rusqlite::Connection;
    use tempfile::TempDir;

    #[test]
    fn migrates_legacy_annotation_notes_to_authorship_columns() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("legacy.db");

        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute_batch(
                "CREATE TABLE annotation_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    annotation_id INTEGER NOT NULL,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                INSERT INTO annotation_notes (annotation_id, body) VALUES (1, 'legacy');",
            )
            .unwrap();
        }

        let conn = init_db(&db_path).unwrap();
        let (author, is_agent): (Option<String>, i64) = conn
            .query_row(
                "SELECT author, is_agent FROM annotation_notes WHERE body = 'legacy'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(author, None);
        assert_eq!(is_agent, 0);
    }
}
