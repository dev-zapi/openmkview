pub mod db;
pub mod handlers;
pub mod models;

use std::sync::Arc;
use tokio::sync::Mutex;

use crate::db::Database;

/// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
}
