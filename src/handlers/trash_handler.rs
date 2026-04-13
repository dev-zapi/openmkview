use crate::db::{ProjectRepository, SettingsRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{
    TrashClearRequest, TrashDeleteRequest, TrashItem, TrashListParams, TrashMoveRequest,
    TrashRestoreRequest, TrashStats,
};
use crate::services::TrashService;
use crate::AppState;
use actix_web::{web, HttpResponse};
use std::path::PathBuf;

pub async fn move_to_trash(
    data: web::Data<AppState>,
    body: web::Json<TrashMoveRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let project_repo = ProjectRepository::new(&conn);
    let project = project_repo
        .find_by_id(body.project_id)?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    let settings_repo = SettingsRepository::new(&conn);
    let settings = settings_repo.get_system_settings()?;

    if TrashService::is_protected_path(&body.path, &settings.protected_paths) {
        return Err(AppError::BadRequest(format!(
            "Cannot delete protected path: {}",
            body.path
        )));
    }

    let project_path = PathBuf::from(&project.path);
    let item =
        TrashService::move_to_trash(&project_path, &body.path, body.is_folder, body.project_id)?;

    Ok(HttpResponse::Ok().json(item))
}

pub async fn restore_from_trash(
    data: web::Data<AppState>,
    body: web::Json<TrashRestoreRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let project_repo = ProjectRepository::new(&conn);
    let project = project_repo
        .find_by_id(body.project_id)?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    let project_path = PathBuf::from(&project.path);
    TrashService::restore_from_trash(&project_path, &body.trash_item_id, body.project_id)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

pub async fn delete_from_trash(
    _data: web::Data<AppState>,
    body: web::Json<TrashDeleteRequest>,
) -> AppResult<HttpResponse> {
    TrashService::delete_from_trash(body.project_id, &body.trash_item_id)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

pub async fn clear_trash(
    _data: web::Data<AppState>,
    body: web::Json<TrashClearRequest>,
) -> AppResult<HttpResponse> {
    TrashService::clear_trash(body.project_id)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

pub async fn list_trash(
    _data: web::Data<AppState>,
    query: web::Query<TrashListParams>,
) -> AppResult<HttpResponse> {
    let items: Vec<TrashItem> = TrashService::list_trash(query.project_id)?;

    Ok(HttpResponse::Ok().json(items))
}

pub async fn get_trash_stats(
    _data: web::Data<AppState>,
    query: web::Query<TrashListParams>,
) -> AppResult<HttpResponse> {
    let stats: TrashStats = TrashService::get_trash_stats(query.project_id)?;

    Ok(HttpResponse::Ok().json(stats))
}
