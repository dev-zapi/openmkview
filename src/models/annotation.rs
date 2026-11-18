use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One entry in an Annotation's time-ordered note thread.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationNote {
    pub id: i64,
    pub annotation_id: i64,
    pub body: String,
    /// Free-text author of the note (logged-in username or agent-supplied
    /// name). `None` marks a legacy note written before authorship existed.
    pub author: Option<String>,
    /// Whether this note came from an agent rather than the human user.
    pub is_agent: bool,
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

/// A project-wide management row: the Annotation plus whether its stored
/// relative path still exists on disk. Rows whose file was renamed or moved
/// outside the app are kept and surfaced here (ADR-0006) instead of being
/// attached to whatever now lives at the old path.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedAnnotation {
    #[serde(flatten)]
    pub annotation: Annotation,
    pub orphaned: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnotationRequest {
    pub project_id: i64,
    pub relative_path: String,
    pub anchor: Value,
    pub body: String,
    /// Author of the first note. Omitted/`null` means legacy/unknown and is
    /// rendered as "—" in the UI.
    #[serde(default)]
    pub author: Option<String>,
    /// Agent voice marker; omitted defaults to `false` (human).
    #[serde(default)]
    pub is_agent: bool,
}

/// Manual re-anchoring of an Outdated annotation: replaces the Anchor payload
/// with a freshly selected one. The server refreshes the stored snapshot from
/// the new payload, which clears the previous Outdated text.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReanchorAnnotationRequest {
    pub anchor: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddNoteRequest {
    pub body: String,
    /// Author of the reply. Omitted/`null` marks the note as legacy/unknown.
    #[serde(default)]
    pub author: Option<String>,
    /// Agent voice marker; omitted defaults to `false` (human).
    #[serde(default)]
    pub is_agent: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteRequest {
    pub body: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetResolvedRequest {
    pub resolved: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnnotationListParams {
    pub project_id: i64,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    /// Optional author filter: keep threads with a note by this author.
    #[serde(default)]
    pub author: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnnotationProjectParams {
    pub project_id: i64,
    /// Optional author filter: keep threads with a note by this author.
    #[serde(default)]
    pub author: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteRequest {
    pub project_id: i64,
    pub ids: Vec<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResolveRequest {
    pub project_id: i64,
    pub ids: Vec<i64>,
    pub resolved: bool,
}
