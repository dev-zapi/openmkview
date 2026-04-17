pub mod auth;
pub mod config;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod models;
pub mod services;
pub mod static_files;

use crate::auth::AuthState;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub auth: Option<Arc<AuthState>>,
}

pub use crate::handlers::*;
