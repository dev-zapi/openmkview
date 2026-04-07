use crate::db::ProjectRepository;
use crate::errors::AppResult;
use crate::models::{
    CreateProjectRequest, PathCandidate, PathType, ResolvePathRequest, ResolvePathResponse,
    UpdateProjectColorRequest, UpdateProjectRequest,
};
use crate::services::ProjectService;
use crate::AppState;
use actix_web::{web, HttpResponse};
use log::debug;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ProjectListParams {
    open: Option<bool>,
}

/// Get recent projects list
pub async fn get_recent_projects(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    debug!("[project] Getting recent projects list");
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let projects = service.get_recent_projects(10)?;
    debug!("[project] Found {} recent projects", projects.len());
    Ok(HttpResponse::Ok().json(projects))
}

/// Validate project path request
#[derive(Debug, Deserialize)]
pub struct ValidateProjectRequest {
    pub path: String,
}

/// Validate project path response
#[derive(Debug, Serialize)]
pub struct ValidateProjectResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Validate project path
pub async fn validate_project(
    data: web::Data<AppState>,
    body: web::Json<ValidateProjectRequest>,
) -> AppResult<HttpResponse> {
    debug!("[project] Validating project path: {}", body.path);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let (valid, reason) = service.validate_project_path(&body.path)?;
    debug!(
        "[project] Path validation result: valid={}, reason={:?}",
        valid, reason
    );

    Ok(HttpResponse::Ok().json(ValidateProjectResponse { valid, reason }))
}

/// Open project request
#[derive(Debug, Deserialize)]
pub struct OpenProjectRequest {
    pub path: String,
}

/// Open project response project info (compatible with frontend RecentProject type)
#[derive(Debug, Serialize)]
pub struct OpenProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
}

/// Open project response
#[derive(Debug, Serialize)]
pub struct OpenProjectResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<OpenProjectInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Open project (create if not exists)
pub async fn open_project(
    data: web::Data<AppState>,
    body: web::Json<OpenProjectRequest>,
) -> AppResult<HttpResponse> {
    debug!("[project] Opening project path: {}", body.path);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let create_req = CreateProjectRequest {
        path: body.path.clone(),
    };

    let project = service.create_or_open_project(&create_req)?;
    debug!(
        "[project] Project opened successfully: id={}, name={}, path={}",
        project.id, project.name, project.path
    );

    let response = OpenProjectResponse {
        success: true,
        project: Some(OpenProjectInfo {
            id: project.id.to_string(),
            name: project.name,
            path: project.path,
            last_opened_at: project.last_opened_at,
            r#type: None,
        }),
        error: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

pub async fn list_projects(
    data: web::Data<AppState>,
    query: web::Query<ProjectListParams>,
) -> AppResult<HttpResponse> {
    let open_only = query.open.unwrap_or(false);
    debug!("[project] Listing projects, open_only={}", open_only);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let projects = service.list_projects(open_only)?;
    debug!("[project] Found {} projects", projects.len());
    Ok(HttpResponse::Ok().json(projects))
}

pub async fn create_project(
    data: web::Data<AppState>,
    body: web::Json<CreateProjectRequest>,
) -> AppResult<HttpResponse> {
    debug!("[project] Creating project: path={}", body.path);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let project = service.create_or_open_project(&body)?;
    debug!(
        "[project] Project created successfully: id={}, name={}",
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
    debug!("[project] Closing project: id={}", id);
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let updated = service.close_project(id)?;

    if !updated {
        debug!("[project] Project not found: id={}", id);
        return Ok(HttpResponse::NotFound().body("Project not found"));
    }

    debug!("[project] Project closed: id={}", id);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Project closed"
    })))
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

fn search_with_depth(
    base_path: &Path,
    target: &str,
    max_depth: i32,
    include_hidden: bool,
) -> Vec<PathCandidate> {
    debug!(
        "[path_search] Searching path: target={}, base={}, max_depth={}, include_hidden={}",
        target,
        base_path.display(),
        max_depth,
        include_hidden
    );
    let mut candidates = Vec::new();
    let target_lower = target.to_lowercase();

    let walker = WalkDir::new(base_path)
        .max_depth(max_depth as usize)
        .into_iter()
        .filter_entry(|e| include_hidden || !is_hidden(e));

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
        "[path_search] Search complete: found {} candidates",
        candidates.len()
    );
    candidates
}

pub async fn resolve_path(body: web::Json<ResolvePathRequest>) -> AppResult<HttpResponse> {
    let path_input = &body.path;
    debug!("[resolve_path] Parsing path input: {}", path_input);

    let (path_type, candidates) = if path_input.starts_with('/') {
        debug!("[resolve_path] Path type: Absolute");
        let (base_path, search_term) = extract_path_and_term(path_input);
        if let Some(base) = base_path {
            debug!(
                "[resolve_path] Absolute path search: base={}, term={}",
                base.display(),
                search_term
            );
            if base.exists() {
                let search_results = search_with_depth(&base, &search_term, 2, true);
                debug!(
                    "[resolve_path] Absolute path search returned {} candidates",
                    search_results.len()
                );
                (PathType::Absolute, search_results)
            } else {
                debug!("[resolve_path] Absolute base path does not exist: {}", base.display());
                (PathType::Absolute, vec![])
            }
        } else {
            (PathType::Absolute, vec![])
        }
    } else if path_input.contains('/') {
        debug!("[resolve_path] Path type: Relative");
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let (base_path, search_term) = extract_path_and_term(path_input);
        if let Some(base) = base_path {
            debug!(
                "[resolve_path] Relative path search: base={}, term={}",
                base.display(),
                search_term
            );
            
            if base.exists() {
                let search_results = search_with_depth(&base, &search_term, 2, true);
                debug!(
                    "[resolve_path] Relative path search returned {} candidates",
                    search_results.len()
                );
                (PathType::Relative, search_results)
            } else {
                debug!(
                    "[resolve_path] Base path '{}' does not exist, searching for matching directories",
                    base.display()
                );
                
                let base_name = base.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                
                if base_name.is_empty() {
                    (PathType::Relative, vec![])
                } else {
                    let mut all_candidates = Vec::new();
                    let base_lower = base_name.to_lowercase();
                    
                    let walker = WalkDir::new(&current_dir)
                        .max_depth(3)
                        .into_iter()
                        .filter_entry(|_| true);
                    
                    for entry in walker.filter_map(|e| e.ok()) {
                        if let Some(file_name) = entry.file_name().to_str() {
                            let file_name_lower = file_name.to_lowercase();
                            if file_name_lower == base_lower && entry.path().is_dir() {
                                debug!(
                                    "[resolve_path] Found matching directory: {}",
                                    entry.path().display()
                                );
                                let sub_results = search_with_depth(entry.path(), &search_term, 2, true);
                                all_candidates.extend(sub_results);
                            }
                        }
                    }
                    
                    debug!(
                        "[resolve_path] Fuzzy directory search returned {} candidates",
                        all_candidates.len()
                    );
                    (PathType::Relative, all_candidates)
                }
            }
        } else {
            (PathType::Relative, vec![])
        }
    } else {
        let home_path = dirs::home_dir()
            .unwrap_or_else(|| std::env::current_dir().expect("Cannot get current directory"));
        debug!(
            "[resolve_path] Path type: Fuzzy, search directory: {}",
            home_path.display()
        );
        let search_results = search_with_depth(&home_path, path_input, 2, false);
        debug!(
            "[resolve_path] Fuzzy search returned {} candidates",
            search_results.len()
        );
        (PathType::Fuzzy, search_results)
    };

    debug!(
        "[resolve_path] Parse complete: path_type={:?}, candidates_count={}",
        path_type,
        candidates.len()
    );
    Ok(HttpResponse::Ok().json(ResolvePathResponse {
        path_type,
        candidates,
    }))
}

fn extract_path_and_term(input: &str) -> (Option<PathBuf>, String) {
    let path = Path::new(input);

    if let Some(parent) = path.parent() {
        if parent.as_os_str().is_empty() {
            return (None, input.to_string());
        }

        let term = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        (Some(parent.to_path_buf()), term)
    } else {
        (None, input.to_string())
    }
}

pub async fn update_project_color(
    data: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateProjectColorRequest>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    debug!(
        "[project] Updating project color: id={}, color={}",
        id, body.color
    );
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    let updated = service.update_project_color(id, &body.color)?;

    if !updated {
        debug!("[project] Project not found: id={}", id);
        return Ok(HttpResponse::NotFound().body("Project not found"));
    }

    debug!("[project] Project color updated: id={}", id);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Project color updated"
    })))
}

pub async fn update_project(
    data: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateProjectRequest>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    debug!(
        "[project] Updating project info: id={}, name={:?}, color={:?}, icon={:?}",
        id, body.name, body.color, body.icon
    );
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let service = ProjectService::new(project_repo);

    service.update_project(
        id,
        body.name.as_deref(),
        body.color.as_deref(),
        body.icon.as_deref(),
    )?;

    // Return updated project info
    let project_repo = ProjectRepository::new(&conn);
    let project = project_repo
        .find_by_id(id)?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".into()))?;

    debug!("[project] Project info updated: id={}", id);
    Ok(HttpResponse::Ok().json(project))
}
