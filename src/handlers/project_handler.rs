use crate::db::ProjectRepository;
use crate::errors::AppResult;
use crate::models::CreateProjectRequest;
use crate::services::ProjectService;
use crate::AppState;
use actix_web::{web, HttpResponse};
use serde::Deserialize;

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

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ProjectListParams {
    open: Option<bool>,
}
