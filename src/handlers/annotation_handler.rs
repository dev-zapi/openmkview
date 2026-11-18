use crate::errors::{AppError, AppResult};
use crate::models::{
    AddNoteRequest, AnnotationListParams, CreateAnnotationRequest, ReanchorAnnotationRequest,
    SetResolvedRequest, UpdateNoteRequest,
};
use crate::services::AnnotationService;
use crate::AppState;
use actix_web::{web, HttpResponse};

/// GET /api/annotations?project_id=<id>&relativePath=<path>
pub async fn list_annotations(
    data: web::Data<AppState>,
    query: web::Query<AnnotationListParams>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let service = AnnotationService::new(&conn);
    let annotations = service.list_for_file(query.project_id, &query.relative_path)?;

    Ok(HttpResponse::Ok().json(annotations))
}

/// POST /api/annotations
pub async fn create_annotation(
    data: web::Data<AppState>,
    body: web::Json<CreateAnnotationRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let service = AnnotationService::new(&conn);
    let annotation = service.create(body.into_inner())?;

    Ok(HttpResponse::Ok().json(annotation))
}

/// PUT /api/annotations/{id}/anchor
pub async fn reanchor_annotation(
    data: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<ReanchorAnnotationRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let service = AnnotationService::new(&conn);
    let annotation = service.reanchor(path.into_inner(), body.into_inner().anchor)?;

    Ok(HttpResponse::Ok().json(annotation))
}

/// DELETE /api/annotations/{id}
pub async fn delete_annotation(
    data: web::Data<AppState>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let service = AnnotationService::new(&conn);
    service.delete(path.into_inner())?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

/// POST /api/annotations/{id}/notes
pub async fn add_note(
    data: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<AddNoteRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let service = AnnotationService::new(&conn);
    let annotation = service.append_note(path.into_inner(), &body.body)?;

    Ok(HttpResponse::Ok().json(annotation))
}

/// PUT /api/annotations/{id}/notes/{note_id}
pub async fn update_note(
    data: web::Data<AppState>,
    path: web::Path<(i64, i64)>,
    body: web::Json<UpdateNoteRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let (annotation_id, note_id) = path.into_inner();
    let service = AnnotationService::new(&conn);
    let annotation = service.update_note(annotation_id, note_id, &body.body)?;

    Ok(HttpResponse::Ok().json(annotation))
}

/// PUT /api/annotations/{id}/resolved
pub async fn set_resolved(
    data: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<SetResolvedRequest>,
) -> AppResult<HttpResponse> {
    let conn = data
        .db
        .lock()
        .map_err(|_| AppError::InternalError("Database lock error".into()))?;

    let service = AnnotationService::new(&conn);
    let annotation = service.set_resolved(path.into_inner(), body.resolved)?;

    Ok(HttpResponse::Ok().json(annotation))
}
