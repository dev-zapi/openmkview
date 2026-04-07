use crate::db::ProjectRepository;
use crate::errors::{AppError, AppResult};
use crate::services::{GitService, ProjectService};
use crate::AppState;
use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct GitRequest {
    pub action: String,
    pub project_id: i64,
    #[serde(default)]
    pub files: Option<Vec<String>>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub limit: Option<i32>,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub staged: Option<bool>,
    #[serde(default)]
    pub commit_hash: Option<String>,
}

pub async fn execute_git(
    data: web::Data<AppState>,
    body: web::Json<GitRequest>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(body.project_id)?;

    match body.action.as_str() {
        "status" => handle_status(&project_path),
        "add" => handle_add(&project_path, &body.files),
        "commit" => handle_commit(&project_path, &body.message),
        "push" => handle_command(&project_path, &["push"]),
        "pull" => handle_pull(&project_path, false),
        "pull-rebase" => handle_pull(&project_path, true),
        "fetch" => handle_command(&project_path, &["fetch", "--all"]),
        "log" => handle_log(&project_path, body.limit.unwrap_or(50)),
        "diff" => handle_diff(&project_path, false, body.file_path.as_deref()),
        "diff-staged" => handle_diff(&project_path, true, body.file_path.as_deref()),
        "show" => handle_show(&project_path, &body),
        "file-at-head" => handle_file_at_head(&project_path, &body.file_path),
        "exec" => handle_exec(&project_path, &body.command),
        _ => Ok(HttpResponse::BadRequest().body(format!("Unknown operation: {}", body.action))),
    }
}

#[allow(dead_code)]
fn handle_status(cwd: &PathBuf) -> AppResult<HttpResponse> {
    let status = GitService::status(cwd);
    Ok(HttpResponse::Ok().json(status))
}

#[allow(dead_code)]
fn handle_add(cwd: &PathBuf, files: &Option<Vec<String>>) -> AppResult<HttpResponse> {
    let mut args = vec!["add"];
    if let Some(files) = files {
        for f in files {
            args.push(f.as_str());
        }
    } else {
        args.push(".");
    }

    GitService::run_git(cwd, &args).map_err(|e| AppError::GitError(e))?;
    handle_status(cwd)
}

#[allow(dead_code)]
fn handle_commit(cwd: &PathBuf, message: &Option<String>) -> AppResult<HttpResponse> {
    let msg = message
        .as_ref()
        .filter(|m| !m.is_empty())
        .ok_or_else(|| AppError::BadRequest("Commit message is required".into()))?;

    GitService::run_git(cwd, &["commit", "-m", msg]).map_err(|e| AppError::GitError(e))?;

    handle_status(cwd)
}

#[allow(dead_code)]
fn handle_command(cwd: &PathBuf, args: &[&str]) -> AppResult<HttpResponse> {
    GitService::run_git(cwd, args).map_err(|e| AppError::GitError(e))?;

    let status = GitService::status(cwd);
    Ok(HttpResponse::Ok().json(status))
}

#[allow(dead_code)]
fn handle_pull(cwd: &PathBuf, rebase: bool) -> AppResult<HttpResponse> {
    let args = if rebase {
        vec!["pull", "--rebase"]
    } else {
        vec!["pull"]
    };

    let (stdout, stderr) = GitService::run_git(cwd, &args).map_err(|e| AppError::GitError(e))?;

    let status = GitService::status(cwd);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "branch": status.branch,
        "files": status.files,
        "isRepo": status.is_repo,
        "output": format!("{}{}", stdout, stderr)
    })))
}

#[allow(dead_code)]
fn handle_log(cwd: &PathBuf, limit: i32) -> AppResult<HttpResponse> {
    let entries = GitService::log(cwd, limit)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "entries": entries })))
}

#[allow(dead_code)]
fn handle_diff(cwd: &PathBuf, staged: bool, file_path: Option<&str>) -> AppResult<HttpResponse> {
    let diff = GitService::diff(cwd, staged, file_path)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "diff": diff })))
}

#[allow(dead_code)]
fn handle_show(cwd: &PathBuf, body: &GitRequest) -> AppResult<HttpResponse> {
    let commit_hash = body.commit_hash.as_ref().or(body.message.as_ref());

    match commit_hash {
        Some(hash) => {
            let content = GitService::show(cwd, hash)?;
            Ok(HttpResponse::Ok().json(serde_json::json!({ "diff": content })))
        }
        None => Ok(HttpResponse::BadRequest().body("Commit hash is required")),
    }
}

#[allow(dead_code)]
fn handle_file_at_head(cwd: &PathBuf, file_path: &Option<String>) -> AppResult<HttpResponse> {
    match file_path {
        Some(path) => {
            let content = GitService::file_at_head(cwd, path).unwrap_or_default();
            Ok(HttpResponse::Ok().json(serde_json::json!({ "content": content })))
        }
        None => Ok(HttpResponse::BadRequest().body("File path is required")),
    }
}

#[allow(dead_code)]
fn handle_exec(cwd: &PathBuf, command: &Option<String>) -> AppResult<HttpResponse> {
    match command {
        Some(cmd) if !cmd.trim().is_empty() => {
            let args: Vec<&str> = cmd.split_whitespace().collect();

            if args.is_empty() {
                return Ok(HttpResponse::BadRequest().body("Command cannot be empty"));
            }

            let (stdout, stderr) =
                GitService::run_git(cwd, &args).map_err(|e| AppError::GitError(e))?;

            Ok(HttpResponse::Ok().json(serde_json::json!({
                "output": format!("{}{}", stdout, stderr)
            })))
        }
        _ => Ok(HttpResponse::BadRequest().body("Command is required")),
    }
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct DiffQuery {
    pub project_id: i64,
    pub path: Option<String>,
    pub old_ref: Option<String>,
    pub new_ref: Option<String>,
}

pub async fn get_commits(
    data: web::Data<AppState>,
    query: web::Query<DiffQuery>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;
    let limit = 50;
    let entries = GitService::log(&project_path, limit)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "entries": entries })))
}

pub async fn get_branches(
    data: web::Data<AppState>,
    query: web::Query<DiffQuery>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;
    let branches = GitService::branches(&project_path)?;

    Ok(HttpResponse::Ok().json(branches))
}

pub async fn get_tags(
    data: web::Data<AppState>,
    query: web::Query<DiffQuery>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;
    let tags = GitService::tags(&project_path)?;

    Ok(HttpResponse::Ok().json(tags))
}

pub async fn get_file_diff(
    data: web::Data<AppState>,
    body: web::Json<DiffQuery>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(body.project_id)?;

    let file_path = body.path.as_deref().unwrap_or("");
    let old_ref = body.old_ref.as_deref().unwrap_or("HEAD~1");
    let new_ref = body.new_ref.as_deref().unwrap_or("HEAD");

    let diff = GitService::file_diff(&project_path, file_path, old_ref, new_ref)?;

    Ok(HttpResponse::Ok().json(diff))
}

pub async fn get_file_at_ref(
    data: web::Data<AppState>,
    query: web::Query<DiffQuery>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let project_repo = ProjectRepository::new(&conn);
    let project_service = ProjectService::new(project_repo);

    let project_path = project_service.get_project_path(query.project_id)?;

    let file_path = query.path.as_deref().unwrap_or("");
    let reference = query.old_ref.as_deref().unwrap_or("HEAD");

    let content = GitService::file_at_ref(&project_path, file_path, reference)?;

    Ok(HttpResponse::Ok().body(content))
}
