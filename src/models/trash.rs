use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashMoveRequest {
    pub project_id: i64,
    pub path: String,
    pub is_folder: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashRestoreRequest {
    pub project_id: i64,
    pub trash_item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashDeleteRequest {
    pub project_id: i64,
    pub trash_item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashClearRequest {
    pub project_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashItem {
    pub id: String,
    #[serde(rename = "originalName")]
    pub original_name: String,
    #[serde(rename = "originalPath")]
    pub original_path: String,
    #[serde(rename = "deletedAt")]
    pub deleted_at: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashMetadata {
    #[serde(rename = "originalPath")]
    pub original_path: String,
    #[serde(rename = "originalName")]
    pub original_name: String,
    pub project_id: i64,
    #[serde(rename = "deletedAt")]
    pub deleted_at: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashStats {
    #[serde(rename = "totalItems")]
    pub total_items: usize,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    #[serde(rename = "oldestItemAge")]
    pub oldest_item_age: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashListParams {
    pub project_id: i64,
}
