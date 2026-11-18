use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One entry in an Annotation's time-ordered note thread.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationNote {
    pub id: i64,
    pub annotation_id: i64,
    pub body: String,
    pub created_at: String,
}

/// A single-user note attached to rendered Markdown content.
///
/// The Anchor is stored as an opaque JSON payload owned by the frontend
/// (ADR-0005); the backend persists it verbatim so later anchor kinds
/// (text-range segments) do not require a schema migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub id: i64,
    pub project_id: i64,
    pub relative_path: String,
    pub anchor: Value,
    pub snapshot: Option<String>,
    pub resolved: bool,
    pub created_at: String,
    pub updated_at: String,
    pub notes: Vec<AnnotationNote>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnotationRequest {
    pub project_id: i64,
    pub relative_path: String,
    pub anchor: Value,
    pub body: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnnotationListParams {
    pub project_id: i64,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
}
