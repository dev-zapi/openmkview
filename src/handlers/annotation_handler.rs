use crate::errors::{AppError, AppResult};
use crate::models::{AnnotationListParams, CreateAnnotationRequest};
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
