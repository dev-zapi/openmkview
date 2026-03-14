use anyhow::Result;
use rusqlite::Connection;
use std::sync::Arc;
use tokio::sync::Mutex;

/// 数据库连接包装器（使用 tokio Mutex 确保 Send+Sync）
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// 创建新的数据库连接
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        // 启用外键
        conn.execute_batch("PRAGMA foreign_keys = ON")?;
        
        // 初始化表结构
        Self::initialize_tables(&conn)?;
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    /// 创建内存数据库（用于测试）
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON")?;
        Self::initialize_tables(&conn)?;
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    /// 初始化数据库表
    fn initialize_tables(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
                is_open INTEGER NOT NULL DEFAULT 1
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            ",
        )?;
        Ok(())
    }
    
    /// 获取数据库连接（返回 Arc 克隆）
    pub fn conn(&self) -> Arc<Mutex<Connection>> {
        self.conn.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_in_memory_db() -> Result<()> {
        let db = Database::in_memory()?;
        assert!(db.conn().is_some());
        Ok(())
    }
}
