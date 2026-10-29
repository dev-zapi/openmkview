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
    #[serde(rename = "fileType", skip_serializing_if = "Option::is_none")]
    pub file_type: Option<String>,
    /// True when any path component starts with a dot (Hidden Entry).
    #[serde(default)]
    pub hidden: bool,
    /// True for Placeholder Directories: visible but not expandable.
    #[serde(rename = "isPlaceholder", default)]
    pub is_placeholder: bool,
    /// File size in bytes (0 for directories).
    #[serde(default)]
    pub size: u64,
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

#[derive(Debug, Deserialize)]
pub struct FileSaveRequest {
    pub project_id: i64,
    /// Relative path from project root (e.g., "docs/readme.md")
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub content: String,
    /// Optional timestamp for optimistic concurrency check
    /// If provided, the save will fail with Conflict if the file has been modified
    /// after this timestamp
    #[serde(rename = "expectedModifiedAt")]
    pub expected_modified_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FileSaveResponse {
    pub success: bool,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
}

#[derive(Debug, Deserialize)]
pub struct FileMoveRequest {
    pub project_id: i64,
    /// Relative path of the source file/directory (e.g., "readme.md", "docs/guide")
    pub from: String,
    /// Relative path of the target directory (e.g., "", "docs")
    pub to: String,
}
