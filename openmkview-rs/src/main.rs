use actix_web::{web, App, HttpServer, HttpResponse, Result};
use rusqlite::{Connection, params};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Mutex;

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
            .route("/api/projects", web::get().to(list_projects))
            .route("/api/projects", web::post().to(create_project))
            .route("/api/projects/{id}", web::delete().to(delete_project))
            .route("/api/files/tree", web::get().to(get_file_tree))
            .route("/api/files/content", web::get().to(get_file_content))
            .route("/api/settings", web::get().to(get_settings))
            .route("/api/settings", web::put().to(update_settings))
    })
    .bind("0.0.0.0:3000")?
    .run()
    .await
}
