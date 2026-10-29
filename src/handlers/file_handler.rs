use crate::db::{ProjectRepository, SettingsRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{FileMoveRequest, FileOperationRequest, FileSaveRequest, FileSaveResponse};
use crate::services::{FileService, ProjectService};
use crate::AppState;
use actix_web::{web, HttpResponse};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FileTreeParams {
    pub project_id: i64,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FileContentParams {
    /// Relative path from project root
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub project_id: i64,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FaviconSearchParams {
    pub project_id: i64,
}

pub async fn get_file_tree(
    data: web::Data<AppState>,
    query: web::Query<FileTreeParams>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;

    let settings = SettingsRepository::new(&conn).get_system_settings()?;
    let tree = FileService::build_tree_from_fs(
        &project_path,
        &settings.placeholder_dirs,
        &settings.ignored_files,
    );

    Ok(HttpResponse::Ok().json(tree))
}

pub async fn get_file_content(
    data: web::Data<AppState>,
    query: web::Query<FileContentParams>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;

    let file = FileService::get_file_content(&project_path, &query.relative_path)?;

    let last_modified_str = file.last_modified.map(|t| {
        let datetime: chrono::DateTime<chrono::Utc> = t.into();
        datetime.to_rfc3339()
    });

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "content": file.content,
        "fileName": file.file_name,
        "path": file.path,  // Return relative path to frontend
        "fileSize": file.file_size,
        "lastModified": last_modified_str,
        "truncated": file.truncated,
        "lossy": file.lossy,
        "binary": file.binary,
        "size": file.size
    })))
}

pub async fn create_file(
    data: web::Data<AppState>,
    body: web::Json<FileOperationRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(body.project_id)?;

    let file_name = body
        .name
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("File name is required".into()))?;

    FileService::create_file(&project_path, file_name)?;
    Ok(HttpResponse::Ok().body("File created successfully"))
}

pub async fn rename_file(
    data: web::Data<AppState>,
    body: web::Json<FileOperationRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(body.project_id)?;

    let old_path = body
        .path
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("File path is required".into()))?;

    let new_name = body
        .new_name
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("New file name is required".into()))?;

    FileService::rename_file(&project_path, old_path, new_name)?;
    Ok(HttpResponse::Ok().body("Renamed successfully"))
}

pub async fn delete_file(
    data: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_id = body["project_id"]
        .as_i64()
        .ok_or_else(|| AppError::BadRequest("project_id is required".into()))?;

    let project_path = project_service.get_project_path(project_id)?;

    let file_path = body["path"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("File path is required".into()))?;

    FileService::delete_file(&project_path, file_path)?;
    Ok(HttpResponse::Ok().body("Deleted successfully"))
}

pub async fn move_file(
    data: web::Data<AppState>,
    body: web::Json<FileMoveRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(body.project_id)?;

    FileService::move_file(&project_path, &body.from, &body.to)?;
    Ok(HttpResponse::Ok().body("Moved successfully"))
}

pub async fn search_favicons(
    data: web::Data<AppState>,
    query: web::Query<FaviconSearchParams>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;
    let favicons = FileService::search_favicons(&project_path)?;

    Ok(HttpResponse::Ok().json(favicons))
}

pub async fn serve_project_file(
    data: web::Data<AppState>,
    query: web::Query<FileContentParams>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;

    let (content, mime_type, file_name) =
        FileService::get_raw_file(&project_path, &query.relative_path)?;

    let mut builder = HttpResponse::Ok();
    builder
        .content_type(mime_type.clone())
        .insert_header(("X-Content-Type-Options", "nosniff"));

    if mime_type == "image/svg+xml" {
        builder
            .insert_header((
                "Content-Security-Policy",
                "default-src 'none'; style-src 'unsafe-inline'",
            ))
            .insert_header((
                "Content-Disposition",
                format!("inline; filename=\"{}\"", file_name),
            ));
    } else {
        builder.insert_header((
            "Content-Disposition",
            format!("inline; filename=\"{}\"", file_name),
        ));
    }

    Ok(builder.body(content))
}

pub async fn save_file_content(
    data: web::Data<AppState>,
    body: web::Json<FileSaveRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(body.project_id)?;

    let expected_modified = body.expected_modified_at.as_deref();
    let (file_size, last_modified) = FileService::save_file_content(
        &project_path,
        &body.relative_path,
        &body.content,
        expected_modified,
    )?;

    let last_modified_str: chrono::DateTime<chrono::Utc> = last_modified.into();

    Ok(HttpResponse::Ok().json(FileSaveResponse {
        success: true,
        file_size,
        last_modified: last_modified_str.to_rfc3339(),
    }))
}
