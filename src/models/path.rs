use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PathType {
    Absolute,
    Relative,
    Fuzzy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathCandidate {
    pub name: String,
    pub path: String,
    pub depth: i32,
    pub relative_path: String,
}

#[derive(Debug, Deserialize)]
pub struct ResolvePathRequest {
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct ResolvePathResponse {
    pub path_type: PathType,
    pub candidates: Vec<PathCandidate>,
}
