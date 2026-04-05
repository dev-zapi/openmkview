use crate::db::ProjectRepository;
use crate::errors::AppResult;
use crate::models::{
    CreateProjectRequest, PathCandidate, PathType, ResolvePathRequest, ResolvePathResponse,
};
use crate::services::ProjectService;
use crate::AppState;
use actix_web::{web, HttpResponse};
use log::debug;
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::{DirEntry, WalkDir};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ProjectListParams {
    open: Option<bool>,
}

/// 获取最近打开的项目列表
pub async fn get_recent_projects(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    debug!("[project] 获取最近打开的项目列表");
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let projects = service.get_recent_projects(10)?;
    debug!("[project] 获取到 {} 个最近项目", projects.len());
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
    debug!("[project] 验证项目路径: {}", body.path);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let (valid, reason) = service.validate_project_path(&body.path)?;
    debug!(
        "[project] 路径验证结果: valid={}, reason={:?}",
        valid, reason
    );

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
    debug!("[project] 打开项目路径: {}", body.path);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let create_req = CreateProjectRequest {
        path: body.path.clone(),
    };

    let project = service.create_or_open_project(&create_req)?;
    debug!(
        "[project] 项目打开成功: id={}, name={}, path={}",
        project.id, project.name, project.path
    );

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
    let open_only = query.open.unwrap_or(false);
    debug!("[project] 列出项目列表, open_only={}", open_only);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let projects = service.list_projects(open_only)?;
    debug!("[project] 获取到 {} 个项目", projects.len());
    Ok(HttpResponse::Ok().json(projects))
}

pub async fn create_project(
    data: web::Data<AppState>,
    body: web::Json<CreateProjectRequest>,
) -> AppResult<HttpResponse> {
    debug!("[project] 创建项目: path={}", body.path);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let project = service.create_or_open_project(&body)?;
    debug!(
        "[project] 项目创建成功: id={}, name={}",
        project.id, project.name
    );

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
    let id = path.into_inner();
    debug!("[project] 关闭项目: id={}", id);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let updated = service.close_project(id)?;

    if !updated {
        debug!("[project] 项目未找到: id={}", id);
        return Ok(HttpResponse::NotFound().body("项目未找到"));
    }

    debug!("[project] 项目已关闭: id={}", id);
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
    debug!(
        "[path_search] 搜索路径: target={}, base={}, max_depth={}",
        target,
        base_path.display(),
        max_depth
    );
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

    debug!(
        "[path_search] 搜索完成: 找到 {} 个候选结果",
        candidates.len()
    );
    candidates
}

pub async fn resolve_path(body: web::Json<ResolvePathRequest>) -> AppResult<HttpResponse> {
    let path_input = &body.path;
    debug!("[resolve_path] 解析路径输入: {}", path_input);

    let (path_type, candidates) = if path_input.starts_with('/') {
        debug!("[resolve_path] 路径类型: Absolute");
        (PathType::Absolute, vec![])
    } else if path_input.contains('/') {
        debug!("[resolve_path] 路径类型: Relative");
        (PathType::Relative, vec![])
    } else {
        let home_path =
            dirs::home_dir().unwrap_or_else(|| std::env::current_dir().expect("无法获取当前目录"));
        debug!(
            "[resolve_path] 路径类型: Fuzzy, 搜索目录: {}",
            home_path.display()
        );
        let search_results = search_with_depth(&home_path, path_input, 2);
        debug!(
            "[resolve_path] Fuzzy 搜索返回 {} 个候选结果",
            search_results.len()
        );
        (PathType::Fuzzy, search_results)
    };

    debug!(
        "[resolve_path] 解析完成: path_type={:?}, candidates_count={}",
        path_type,
        candidates.len()
    );
    Ok(HttpResponse::Ok().json(ResolvePathResponse {
        path_type,
        candidates,
    }))
}
