use actix_web::{web, App, HttpServer, HttpResponse, Result};
use actix_files::Files;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::process::Command;

mod models;

pub struct AppState {
    db: Mutex<Connection>,
}

#[derive(Debug, Deserialize)]
struct ProjectListParams {
    open: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CreateProjectRequest {
    path: String,
}

#[derive(Debug, Deserialize)]
struct FileTreeParams {
    project_id: i64,
}

#[derive(Debug, Deserialize)]
struct FileContentParams {
    path: String,
    project_id: i64,
}

#[derive(Debug, Deserialize)]
struct GitRequest {
    action: String,
    project_id: i64,
    #[serde(default)]
    files: Option<Vec<String>>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    limit: Option<i32>,
    #[serde(default)]
    file_path: Option<String>,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    staged: Option<bool>,
    #[serde(default)]
    commit_hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GitFileStatus {
    path: String,
    index: String,
    #[serde(rename = "workTree")]
    work_tree: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GitStatus {
    branch: String,
    files: Vec<GitFileStatus>,
    #[serde(rename = "isRepo")]
    is_repo: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GitLogEntry {
    hash: String,
    #[serde(rename = "shortHash")]
    short_hash: String,
    #[serde(rename = "authorName")]
    author_name: String,
    #[serde(rename = "authorEmail")]
    author_email: String,
    date: String,
    message: String,
}

async fn list_projects(
    data: web::Data<AppState>,
    query: web::Query<ProjectListParams>,
) -> Result<HttpResponse> {
    let conn = data.db.lock().unwrap();
    
    let query_str = if query.open.unwrap_or(false) {
        "SELECT id, path, name, created_at, last_opened_at, is_open 
         FROM projects WHERE is_open = 1 ORDER BY last_opened_at DESC"
    } else {
        "SELECT id, path, name, created_at, last_opened_at, is_open 
         FROM projects ORDER BY last_opened_at DESC"
    };
    
    let mut stmt = conn.prepare(query_str).unwrap();
    let projects = stmt.query_map([], |row| {
        Ok(models::Project {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
            last_opened_at: row.get(4)?,
            is_open: row.get::<_, i32>(5)? != 0,
        })
    }).unwrap();
    
    let project_list: Vec<models::Project> = projects.filter_map(|r| r.ok()).collect();
    
    Ok(HttpResponse::Ok().json(project_list))
}

async fn create_project(
    data: web::Data<AppState>,
    body: web::Json<CreateProjectRequest>,
) -> Result<HttpResponse> {
    let resolved_path = match PathBuf::from(&body.path).canonicalize() {
        Ok(p) => p,
        Err(_) => return Ok(HttpResponse::BadRequest().body("目录不存在")),
    };
    
    if !resolved_path.is_dir() {
        return Ok(HttpResponse::BadRequest().body("路径不是目录"));
    }
    
    let path_str = resolved_path.to_str().unwrap().to_string();
    let name = resolved_path.file_name().unwrap().to_str().unwrap().to_string();
    
    let conn = data.db.lock().unwrap();
    
    let existing: Option<i64> = conn.query_row(
        "SELECT id FROM projects WHERE path = ?",
        [&path_str],
        |row| row.get(0)
    ).ok();
    
    if let Some(id) = existing {
        conn.execute(
            "UPDATE projects SET is_open = 1, last_opened_at = datetime('now') WHERE id = ?",
            [id],
        ).unwrap();
        
        let project = conn.query_row(
            "SELECT id, path, name, created_at, last_opened_at, is_open FROM projects WHERE id = ?",
            [id],
            |row| {
                Ok(models::Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    last_opened_at: row.get(4)?,
                    is_open: row.get::<_, i32>(5)? != 0,
                })
            },
        ).unwrap();
        
        Ok(HttpResponse::Ok().json(project))
    } else {
        conn.execute(
            "INSERT INTO projects (path, name, is_open) VALUES (?, ?, 1)",
            (&path_str, &name),
        ).unwrap();
        
        let id = conn.last_insert_rowid();
        
        let project = conn.query_row(
            "SELECT id, path, name, created_at, last_opened_at, is_open FROM projects WHERE id = ?",
            [id],
            |row| {
                Ok(models::Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    last_opened_at: row.get(4)?,
                    is_open: row.get::<_, i32>(5)? != 0,
                })
            },
        ).unwrap();
        
        Ok(HttpResponse::Created().json(project))
    }
}

async fn delete_project(
    data: web::Data<AppState>,
    path: web::Path<i64>,
) -> Result<HttpResponse> {
    let id = path.into_inner();
    let conn = data.db.lock().unwrap();
    
    let rows = conn.execute(
        "UPDATE projects SET is_open = 0 WHERE id = ?",
        [id],
    ).unwrap();
    
    if rows == 0 {
        return Ok(HttpResponse::NotFound().body("项目未找到"));
    }
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "项目已关闭"
    })))
}

/// Git 操作辅助函数
fn get_project_path(conn: &Connection, project_id: i64) -> Option<PathBuf> {
    let path: String = conn.query_row(
        "SELECT path FROM projects WHERE id = ?",
        [project_id],
        |row| row.get(0)
    ).ok()?;
    Some(PathBuf::from(path))
}

fn run_git(cwd: &PathBuf, args: &[&str]) -> Result<(String, String), String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Git 执行失败：{}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    Ok((stdout, stderr))
}

fn parse_status(stdout: &str) -> Vec<GitFileStatus> {
    let mut files = Vec::new();
    
    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        
        let chars: Vec<char> = line.chars().collect();
        let index = chars[0].to_string();
        let work_tree = chars[1].to_string();
        let path = if line.len() > 3 {
            line[3..].to_string()
        } else {
            String::new()
        };
        
        files.push(GitFileStatus {
            path,
            index,
            work_tree,
        });
    }
    
    files
}

fn git_status(cwd: &PathBuf) -> GitStatus {
    match run_git(cwd, &["status", "--porcelain"]) {
        Ok((stdout, _)) => {
            let files = parse_status(&stdout);
            
            let branch = run_git(cwd, &["branch", "--show-current"])
                .map(|(out, _)| out.trim().to_string())
                .unwrap_or_default();
            
            GitStatus {
                is_repo: true,
                branch,
                files,
                output: None,
            }
        }
        Err(_) => GitStatus {
            is_repo: false,
            branch: String::new(),
            files: Vec::new(),
            output: None,
        }
    }
}

async fn execute_git(
    data: web::Data<AppState>,
    body: web::Json<GitRequest>,
) -> Result<HttpResponse> {
    let conn = data.db.lock().unwrap();
    
    let cwd = match get_project_path(&conn, body.project_id) {
        Some(p) => p,
        None => return Ok(HttpResponse::NotFound().body("项目未找到")),
    };
    
    match body.action.as_str() {
        "status" => {
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(status))
        }
        
        "add" => {
            let mut args = vec!["add"];
            if let Some(ref files) = body.files {
                for f in files {
                    args.push(f.as_str());
                }
            } else {
                args.push(".");
            }
            
            if let Err(e) = run_git(&cwd, &args) {
                return Ok(HttpResponse::InternalServerError().body(e));
            }
            
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(status))
        }
        
        "commit" => {
            let message = match &body.message {
                Some(m) if !m.is_empty() => m,
                _ => return Ok(HttpResponse::BadRequest().body("提交信息是必需的")),
            };
            
            if let Err(e) = run_git(&cwd, &["commit", "-m", message]) {
                return Ok(HttpResponse::InternalServerError().body(e));
            }
            
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(status))
        }
        
        "push" => {
            if let Err(e) = run_git(&cwd, &["push"]) {
                return Ok(HttpResponse::InternalServerError().body(e));
            }
            
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(status))
        }
        
        "pull" => {
            let (stdout, stderr) = match run_git(&cwd, &["pull"]) {
                Ok(r) => r,
                Err(e) => return Ok(HttpResponse::InternalServerError().body(e)),
            };
            
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "branch": status.branch,
                "files": status.files,
                "isRepo": status.is_repo,
                "output": format!("{}{}", stdout, stderr)
            })))
        }
        
        "pull-rebase" => {
            let (stdout, stderr) = match run_git(&cwd, &["pull", "--rebase"]) {
                Ok(r) => r,
                Err(e) => return Ok(HttpResponse::InternalServerError().body(e)),
            };
            
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "branch": status.branch,
                "files": status.files,
                "isRepo": status.is_repo,
                "output": format!("{}{}", stdout, stderr)
            })))
        }
        
        "fetch" => {
            let (stdout, stderr) = match run_git(&cwd, &["fetch", "--all"]) {
                Ok(r) => r,
                Err(e) => return Ok(HttpResponse::InternalServerError().body(e)),
            };
            
            let status = git_status(&cwd);
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "branch": status.branch,
                "files": status.files,
                "isRepo": status.is_repo,
                "output": format!("{}{}", stdout, stderr)
            })))
        }
        
        "log" => {
            let limit = body.limit.unwrap_or(50);
            let format = "%H%x00%an%x00%ae%x00%aI%x00%s";
            
            let (stdout, _) = match run_git(&cwd, &[
                "log", 
                &format!("--format={}", format), 
                "-n", 
                &limit.to_string()
            ]) {
                Ok(r) => r,
                Err(e) => return Ok(HttpResponse::InternalServerError().body(e)),
            };
            
            let entries: Vec<GitLogEntry> = stdout
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('\0').collect();
                    if parts.len() >= 5 {
                        Some(GitLogEntry {
                            hash: parts[0].to_string(),
                            short_hash: parts[0][..7.min(parts[0].len())].to_string(),
                            author_name: parts[1].to_string(),
                            author_email: parts[2].to_string(),
                            date: parts[3].to_string(),
                            message: parts[4].to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect();
            
            Ok(HttpResponse::Ok().json(serde_json::json!({ "entries": entries })))
        }
        
        "diff" => {
            let mut args = vec!["diff"];
            if let Some(ref path) = body.file_path {
                args.push("--");
                args.push(path);
            }
            
            let (stdout, _) = match run_git(&cwd, &args) {
                Ok(r) => r,
                Err(_) => (String::new(), String::new()),
            };
            
            Ok(HttpResponse::Ok().json(serde_json::json!({ "diff": stdout })))
        }
        
        "diff-staged" => {
            let mut args = vec!["diff", "--cached"];
            if let Some(ref path) = body.file_path {
                args.push("--");
                args.push(path);
            }
            
            let (stdout, _) = match run_git(&cwd, &args) {
                Ok(r) => r,
                Err(_) => (String::new(), String::new()),
            };
            
            Ok(HttpResponse::Ok().json(serde_json::json!({ "diff": stdout })))
        }
        
        "show" => {
            let commit_hash = body.commit_hash.as_ref().or(body.message.as_ref());
            
            match commit_hash {
                Some(hash) => {
                    let (stdout, _) = match run_git(&cwd, &["show", hash]) {
                        Ok(r) => r,
                        Err(_) => (String::new(), String::new()),
                    };
                    
                    Ok(HttpResponse::Ok().json(serde_json::json!({ "diff": stdout })))
                }
                None => Ok(HttpResponse::BadRequest().body("提交哈希是必需的")),
            }
        }
        
        "file-at-head" => {
            match &body.file_path {
                Some(file_path) => {
                    match run_git(&cwd, &["show", &format!("HEAD:{}", file_path)]) {
                        Ok((stdout, _)) => {
                            Ok(HttpResponse::Ok().json(serde_json::json!({ "content": stdout })))
                        }
                        Err(_) => {
                            Ok(HttpResponse::Ok().json(serde_json::json!({ "content": "" })))
                        }
                    }
                }
                None => Ok(HttpResponse::BadRequest().body("文件路径是必需的")),
            }
        }
        
        "exec" => {
            match &body.command {
                Some(cmd) if !cmd.trim().is_empty() => {
                    let args: Vec<&str> = cmd.split_whitespace().collect();
                    
                    if args.is_empty() {
                        return Ok(HttpResponse::BadRequest().body("命令不能为空"));
                    }
                    
                    let (stdout, stderr) = match run_git(&cwd, &args) {
                        Ok(r) => r,
                        Err(e) => return Ok(HttpResponse::InternalServerError().body(e)),
                    };
                    
                    Ok(HttpResponse::Ok().json(serde_json::json!({ 
                        "output": format!("{}{}", stdout, stderr) 
                    })))
                }
                _ => Ok(HttpResponse::BadRequest().body("命令是必需的")),
            }
        }
        
        _ => Ok(HttpResponse::BadRequest().body(format!("未知操作：{}", body.action))),
    }
}

async fn get_file_tree(
    data: web::Data<AppState>,
    query: web::Query<FileTreeParams>,
) -> Result<HttpResponse> {
    let conn = data.db.lock().unwrap();
    
    let project_path: String = match conn.query_row(
        "SELECT path FROM projects WHERE id = ?",
        [query.project_id],
        |row| row.get(0)
    ) {
        Ok(p) => p,
        Err(_) => return Ok(HttpResponse::NotFound().body("项目未找到")),
    };
    
    let root_path = PathBuf::from(&project_path);
    let mut files = Vec::new();
    
    for entry in walkdir::WalkDir::new(&root_path)
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
                    if let Ok(rel) = path.strip_prefix(&root_path) {
                        files.push(rel.to_path_buf());
                    }
                }
            }
        }
    }
    
    let tree = models::build_tree(&files, &root_path);
    Ok(HttpResponse::Ok().json(tree))
}

async fn get_file_content(
    data: web::Data<AppState>,
    query: web::Query<FileContentParams>,
) -> Result<HttpResponse> {
    let conn = data.db.lock().unwrap();
    
    let project_path: String = match conn.query_row(
        "SELECT path FROM projects WHERE id = ?",
        [query.project_id],
        |row| row.get(0)
    ) {
        Ok(p) => p,
        Err(_) => return Ok(HttpResponse::NotFound().body("项目未找到")),
    };
    
    let file_path = PathBuf::from(&query.path);
    let resolved = match file_path.canonicalize() {
        Ok(r) => r,
        Err(_) => return Ok(HttpResponse::NotFound().body("文件不存在")),
    };
    
    let project_resolved = PathBuf::from(&project_path).canonicalize().unwrap();
    
    if !resolved.starts_with(&project_resolved) {
        return Ok(HttpResponse::Forbidden().body("访问被拒绝"));
    }
    
    let ext = resolved.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
    
    if ext != Some("md".to_string()) && ext != Some("mdx".to_string()) {
        return Ok(HttpResponse::BadRequest().body("只支持 Markdown 文件"));
    }
    
    let content = match std::fs::read_to_string(&resolved) {
        Ok(c) => c,
        Err(_) => return Ok(HttpResponse::InternalServerError().body("读取文件失败")),
    };
    
    let file_name = resolved.file_name().unwrap().to_str().unwrap().to_string();
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "content": content,
        "fileName": file_name,
        "path": resolved.to_str().unwrap()
    })))
}

async fn get_settings(data: web::Data<AppState>) -> Result<HttpResponse> {
    let conn = data.db.lock().unwrap();
    
    let settings_json: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = ?",
        ["system"],
        |row| row.get(0)
    ).ok();
    
    if let Some(json) = settings_json {
        if let Ok(settings) = serde_json::from_str::<models::SystemSettings>(&json) {
            return Ok(HttpResponse::Ok().json(settings));
        }
    }
    
    Ok(HttpResponse::Ok().json(models::SystemSettings::default()))
}

async fn index() -> Result<HttpResponse> {
    use std::fs;
    let html = fs::read_to_string("src/templates/index.html")
        .unwrap_or_else(|_| String::from("<h1>Loading...</h1>"));
    Ok(HttpResponse::Ok().content_type("text/html").body(html))
}

async fn update_settings(
    data: web::Data<AppState>,
    body: web::Json<models::SystemSettings>,
) -> Result<HttpResponse> {
    let conn = data.db.lock().unwrap();
    
    let settings = body.into_inner();
    let json = serde_json::to_string(&settings).unwrap();
    
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) 
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params!["system", json],
    ).unwrap();
    
    Ok(HttpResponse::Ok().json(settings))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let data_dir = cwd.join("data");
    std::fs::create_dir_all(&data_dir).expect("无法创建数据目录");
    
    let db_path = data_dir.join("openmkview.db");
    let conn = Connection::open(&db_path).unwrap();
    
    conn.execute_batch("PRAGMA foreign_keys = ON").unwrap();
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
            is_open INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );"
    ).unwrap();
    
    log::info!("数据库初始化完成：{:?}", db_path);
    
    let app_state = web::Data::new(AppState {
        db: Mutex::new(conn),
    });
    
    log::info!("服务器启动于 http://0.0.0.0:3000");
    
    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .route("/", web::get().to(index))
            .route("/api/projects", web::get().to(list_projects))
            .route("/api/projects", web::post().to(create_project))
            .route("/api/projects/{id}", web::delete().to(delete_project))
            .route("/api/files/tree", web::get().to(get_file_tree))
            .route("/api/files/content", web::get().to(get_file_content))
            .route("/api/settings", web::get().to(get_settings))
            .route("/api/settings", web::put().to(update_settings))
            .route("/api/git", web::post().to(execute_git))
            .service(Files::new("/static", "./templates").show_files_listing())
    })
    .bind("0.0.0.0:3000")?
    .run()
    .await
}
