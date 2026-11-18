use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSession {
    pub id: i64,
    pub label: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateToolSessionRequest {
    pub username: String,
    pub password: String,
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateToolSessionResponse {
    pub id: i64,
    pub label: String,
    pub token: String,
    pub created_at: String,
}
