use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct FileContentResponse {
    pub content: String,
    pub html: String,
    pub headings: Vec<HeadingInfo>,
    pub file_name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadingInfo {
    pub id: String,
    pub text: String,
    pub depth: i32,
}

#[derive(Debug, Deserialize)]
pub struct FileOperationRequest {
    #[allow(dead_code)]
    pub action: String,
    pub project_id: i64,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub new_name: Option<String>,
}
