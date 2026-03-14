use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 项目信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub last_opened_at: String,
    pub is_open: bool,
}

/// 文件树节点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
}

/// 文档标题信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadingInfo {
    pub id: String,
    pub text: String,
    pub depth: i32,
}

/// 视图模式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ViewMode {
    Preview,
    Source,
    Diff,
}

/// 系统设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSettings {
    pub markdown_width: WidthSetting,
    pub ui_font: FontSetting,
    pub markdown_font: FontSetting,
    pub table_width: TableWidthMode,
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            markdown_width: WidthSetting {
                mode: WidthMode::Full,
                fixed_width: "70%".to_string(),
            },
            ui_font: FontSetting {
                font_family: String::new(),
                font_size: "14px".to_string(),
            },
            markdown_font: FontSetting {
                font_family: String::new(),
                font_size: "16px".to_string(),
            },
            table_width: TableWidthMode::Full,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidthSetting {
    #[serde(rename = "mode")]
    pub mode: WidthMode,
    #[serde(rename = "fixedWidth")]
    pub fixed_width: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WidthMode {
    Full,
    Fixed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontSetting {
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    #[serde(rename = "fontSize")]
    pub font_size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TableWidthMode {
    Auto,
    Full,
}

/// Git 文件状态代码
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GitFileStatusCode {
    #[serde(rename = " ")]
    Unmodified,
    #[serde(rename = "M")]
    Modified,
    #[serde(rename = "A")]
    Added,
    #[serde(rename = "D")]
    Deleted,
    #[serde(rename = "R")]
    Renamed,
    #[serde(rename = "C")]
    Copied,
    #[serde(rename = "U")]
    Unmerged,
    #[serde(rename = "?")]
    Untracked,
    #[serde(rename = "!")]
    Ignored,
}

/// Git 文件状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub index: GitFileStatusCode,
    pub work_tree: GitFileStatusCode,
}

/// Git 状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub files: Vec<GitFileStatus>,
    pub is_repo: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

/// Git 日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
    pub message: String,
}

/// API 响应包装器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(message: &str) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
}
