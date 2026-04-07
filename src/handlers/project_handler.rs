use crate::db::ProjectRepository;
use crate::errors::AppResult;
use crate::models::{
    CreateProjectRequest, ResolvePathRequest, UpdateProjectColorRequest, UpdateProjectRequest,
};
use crate::services::{PathSearchService, ProjectService};
use crate::AppState;
use actix_web::{web, HttpResponse};
use log::debug;
use serde::{Deserialize, Serialize};

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

pub async fn resolve_path(body: web::Json<ResolvePathRequest>) -> AppResult<HttpResponse> {
    let response = PathSearchService::resolve_path(&body.path);
    Ok(HttpResponse::Ok().json(response))
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
