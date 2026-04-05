use crate::db::ProjectRepository;
use crate::errors::AppResult;
use crate::models::{
    CreateProjectRequest, PathCandidate, PathType, ResolvePathRequest, ResolvePathResponse,
};
use crate::services::ProjectService;
use crate::AppState;
use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ProjectListParams {
    open: Option<bool>,
}

/// 获取最近打开的项目列表
pub async fn get_recent_projects(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let projects = service.get_recent_projects(10)?;
    Ok(HttpResponse::Ok().json(projects))
}

/// 验证项目路径请求
#[derive(Debug, Deserialize)]
pub struct ValidateProjectRequest {
    pub path: String,
}

/// 验证项目路径响应
#[derive(Debug, Serialize)]
pub struct ValidateProjectResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// 验证项目路径
pub async fn validate_project(
    data: web::Data<AppState>,
    body: web::Json<ValidateProjectRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let (valid, reason) = service.validate_project_path(&body.path)?;

    Ok(HttpResponse::Ok().json(ValidateProjectResponse { valid, reason }))
}

/// 打开项目请求
#[derive(Debug, Deserialize)]
pub struct OpenProjectRequest {
    pub path: String,
}

/// 打开项目（如果不存在则创建）
pub async fn open_project(
    data: web::Data<AppState>,
    body: web::Json<OpenProjectRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    // 复用 create_or_open_project 逻辑
    let create_req = CreateProjectRequest {
        path: body.path.clone(),
    };

    let project = service.create_or_open_project(&create_req)?;

    let mut status = if project.is_open {
        HttpResponse::Ok()
    } else {
        HttpResponse::Created()
    };

    Ok(status.json(project))
}

pub async fn list_projects(
    data: web::Data<AppState>,
    query: web::Query<ProjectListParams>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let projects = service.list_projects(query.open.unwrap_or(false))?;
    Ok(HttpResponse::Ok().json(projects))
}

pub async fn create_project(
    data: web::Data<AppState>,
    body: web::Json<CreateProjectRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let project = service.create_or_open_project(&body)?;

    let mut status = if project.is_open {
        HttpResponse::Ok()
    } else {
        HttpResponse::Created()
    };

    Ok(status.json(project))
}

pub async fn delete_project(
    data: web::Data<AppState>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let id = path.into_inner();
    let updated = service.close_project(id)?;

    if !updated {
        return Ok(HttpResponse::NotFound().body("项目未找到"));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "项目已关闭"
    })))
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

fn search_with_depth(base_path: &Path, target: &str, max_depth: i32) -> Vec<PathCandidate> {
    let mut candidates = Vec::new();
    let target_lower = target.to_lowercase();

    let walker = WalkDir::new(base_path)
        .max_depth(max_depth as usize)
        .into_iter()
        .filter_entry(|e| !is_hidden(e));

    for entry in walker.filter_map(|e| e.ok()) {
        if let Some(file_name) = entry.file_name().to_str() {
            let file_name_lower = file_name.to_lowercase();
            if file_name_lower.contains(&target_lower) {
                let full_path = entry.path();
                if let Ok(relative) = full_path.strip_prefix(base_path) {
                    let relative_path = relative.to_string_lossy().to_string();
                    let depth = relative.components().count() as i32;

                    candidates.push(PathCandidate {
                        name: file_name.to_string(),
                        path: full_path.to_string_lossy().to_string(),
                        depth,
                        relative_path: if relative_path.is_empty() {
                            file_name.to_string()
                        } else {
                            relative_path
                        },
                    });
                }
            }
        }
    }

    candidates
}

pub async fn resolve_path(body: web::Json<ResolvePathRequest>) -> AppResult<HttpResponse> {
    let path_input = &body.path;

    let (path_type, candidates) = if path_input.starts_with('/') {
        (PathType::Absolute, vec![])
    } else if path_input.contains('/') {
        (PathType::Relative, vec![])
    } else {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let home_path = PathBuf::from(home);
        let search_results = search_with_depth(&home_path, path_input, 2);
        (PathType::Fuzzy, search_results)
    };

    Ok(HttpResponse::Ok().json(ResolvePathResponse {
        path_type,
        candidates,
    }))
}
