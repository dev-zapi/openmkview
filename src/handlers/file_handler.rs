use crate::db::ProjectRepository;
use crate::errors::{AppError, AppResult};
use crate::models::FileOperationRequest;
use crate::services::{FileService, ProjectService};
use crate::AppState;
use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FileTreeParams {
    pub project_id: i64,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FileContentParams {
    pub path: String,
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

    let files = collect_markdown_files(&project_path);
    let tree = FileService::build_tree(&files, &project_path);

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

    let (content, file_name, path, file_size, last_modified) =
        FileService::get_file_content(&project_path, &query.path)?;

    let last_modified_str = last_modified.map(|t| {
        let datetime: chrono::DateTime<chrono::Utc> = t.into();
        datetime.to_rfc3339()
    });

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "content": content,
        "fileName": file_name,
        "path": path,
        "fileSize": file_size,
        "lastModified": last_modified_str
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

#[allow(dead_code)]
fn collect_markdown_files(root_path: &PathBuf) -> Vec<PathBuf> {
    let mut files = Vec::new();

    for entry in walkdir::WalkDir::new(root_path)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != "node_modules" && name != ".git"
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "mdx" {
                    if let Ok(rel) = path.strip_prefix(root_path) {
                        files.push(rel.to_path_buf());
                    }
                }
            }
        }
    }

    files
}
