pub mod db;
pub mod errors;
pub mod handlers;
pub mod models;
pub mod services;
pub mod static_files;

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
}

pub use crate::handlers::*;
