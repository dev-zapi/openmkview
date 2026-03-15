use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub last_opened_at: String,
    pub is_open: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub path: String,
}
