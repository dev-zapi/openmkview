use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, put},
    Router,
};
use serde::Deserialize;
use crate::AppState;
use crate::models::SystemSettings;

/// 设置更新请求
#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    #[serde(flatten)]
    pub settings: SystemSettings,
}

/// 创建设置路由器
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_settings))
        .route("/", put(update_settings))
}

/// GET /api/settings - 获取系统设置
async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<SystemSettings>, StatusCode> {
    let conn = state.db.conn().lock().await;
    
    // 尝试从数据库加载设置
    let settings_json: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?", ["system"], |row| {
            row.get(0)
        })
        .ok();
    
    if let Some(json) = settings_json {
        match serde_json::from_str::<SystemSettings>(&json) {
            Ok(settings) => return Ok(Json(settings)),
            Err(_) => {
                // JSON 解析失败，使用默认值
            }
        }
    }
    
    // 返回默认设置
    Ok(Json(SystemSettings::default()))
}

/// PUT /api/settings - 更新系统设置
async fn update_settings(
    Json(req): Json<UpdateSettingsRequest>,
    State(state): State<AppState>,
) -> Result<Json<SystemSettings>, StatusCode> {
    let conn = state.db.conn().lock().await;
    
    // 序列化设置为 JSON
    let settings_json = serde_json::to_string(&req.settings)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // 使用 upsert 模式
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) 
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET 
         value = excluded.value,
         updated_at = excluded.updated_at",
        ["system", settings_json.as_str()],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(req.settings))
}
