use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use crate::AppState;
use crate::models::Project;

/// 项目列表查询参数
#[derive(Debug, Deserialize)]
pub struct ProjectListParams {
    open: Option<bool>,
}

/// 创建项目请求
#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    path: String,
}

/// 删除项目响应
#[derive(Debug, serde::Serialize)]
pub struct DeleteProjectResponse {
    success: bool,
    message: String,
}

/// 创建项目路由器
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_projects))
        .route("/", post(create_project))
        .route("/:id", delete(delete_project))
}

/// GET /api/projects - 获取项目列表
async fn list_projects(
    Query(params): Query<ProjectListParams>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>, StatusCode> {
    let conn = state.db.conn().lock().await;
    
    let query = if params.open.unwrap_or(false) {
        "SELECT id, path, name, created_at, last_opened_at, is_open 
         FROM projects 
         WHERE is_open = 1 
         ORDER BY last_opened_at DESC"
    } else {
        "SELECT id, path, name, created_at, last_opened_at, is_open 
         FROM projects 
         ORDER BY last_opened_at DESC"
    };
    
    let mut stmt = conn.prepare(query).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                last_opened_at: row.get(4)?,
                is_open: row.get::<_, i32>(5)? != 0,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(Json(projects))
}

/// POST /api/projects - 创建/打开项目
async fn create_project(
    Json(req): Json<CreateProjectRequest>,
    State(state): State<AppState>,
) -> Result<Json<Project>, (StatusCode, String)> {
    // 验证路径
    let resolved_path = PathBuf::from(&req.path)
        .canonicalize()
        .map_err(|_| (StatusCode::BAD_REQUEST, "目录不存在".to_string()))?;
    
    // 确保是目录
    if !resolved_path.is_dir() {
        return Err((StatusCode::BAD_REQUEST, "路径不是目录".to_string()));
    }
    
    let path_str = resolved_path
        .to_str()
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "无效的路径".to_string()))?
        .to_string();
    
    let name = resolved_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "无法获取目录名".to_string()))?
        .to_string();
    
    let conn = db.conn();
    
    // 检查是否已存在
    let existing: Option<i64> = conn
        .query_row("SELECT id FROM projects WHERE path = ?", [path_str.as_str()], |row| {
            row.get(0)
        })
        .ok();
    
    if let Some(id) = existing {
        // 更新现有项目
        conn.execute(
            "UPDATE projects SET is_open = 1, last_opened_at = datetime('now') WHERE id = ?",
            [id],
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "数据库更新失败".to_string()))?;
        
        // 获取更新后的项目
        let project = conn
            .query_row(
                "SELECT id, path, name, created_at, last_opened_at, is_open FROM projects WHERE id = ?",
                [id],
                |row| {
                    Ok(Project {
                        id: row.get(0)?,
                        path: row.get(1)?,
                        name: row.get(2)?,
                        created_at: row.get(3)?,
                        last_opened_at: row.get(4)?,
                        is_open: row.get::<_, i32>(5)? != 0,
                    })
                },
            )
            .map_err(|_| (StatusCode::NOT_FOUND, "项目未找到".to_string()))?;
        
        Ok(Json(project))
    } else {
        // 插入新项目
        conn.execute(
            "INSERT INTO projects (path, name, is_open) VALUES (?, ?, 1)",
            (path_str.as_str(), name.as_str()),
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "数据库插入失败".to_string()))?;
        
        let id = conn.last_insert_rowid();
        
        let project = conn
            .query_row(
                "SELECT id, path, name, created_at, last_opened_at, is_open FROM projects WHERE id = ?",
                [id],
                |row| {
                    Ok(Project {
                        id: row.get(0)?,
                        path: row.get(1)?,
                        name: row.get(2)?,
                        created_at: row.get(3)?,
                        last_opened_at: row.get(4)?,
                        is_open: row.get::<_, i32>(5)? != 0,
                    })
                },
            )
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "无法获取新项目".to_string()))?;
        
        Ok(Json(project))
    }
}

/// DELETE /api/projects/:id - 删除项目
async fn delete_project(
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<DeleteProjectResponse>, StatusCode> {
    let conn = state.db.conn().lock().await;
    
    let rows_affected = conn
        .execute("UPDATE projects SET is_open = 0 WHERE id = ?", [id])
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if rows_affected == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    
    Ok(Json(DeleteProjectResponse {
        success: true,
        message: "项目已关闭".to_string(),
    }))
}
