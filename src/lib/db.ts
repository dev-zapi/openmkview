import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "openmkview.db");

// Use globalThis to persist the DB connection across HMR reloads in development.
// Without this, each HMR cycle re-evaluates the module and creates a new connection,
// which can cause "database is locked" errors or connection leaks.
const globalForDb = globalThis as unknown as {
  __openmkview_db?: Database.Database;
};

export function getDb(): Database.Database {
  if (!globalForDb.__openmkview_db) {
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeDb(db);
    globalForDb.__openmkview_db = db;
  }
  return globalForDb.__openmkview_db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_open INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
