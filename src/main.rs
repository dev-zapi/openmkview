use actix_files::{Files, NamedFile};
use actix_web::{middleware::Logger, web, App, HttpRequest, HttpServer, Result};
use clap::Parser;
use std::sync::{Arc, Mutex};

const DEBUG_LOG_FORMAT: &str = r#"=== HTTP Request ===
Method: %m
URI: %U
Version: %V
Query: %q
Peer: %a
Headers: %{Accept}i, %{User-Agent}i, %{Content-Type}i
=== HTTP Response ===
Status: %s
Size: %b bytes
Time: %T seconds"#;

mod db;
mod errors;
mod handlers;
mod models;
mod services;

use db::init_db;
use handlers::{
    create_file, create_project, delete_file, delete_project, execute_git, get_branches,
    get_commits, get_file_at_ref, get_file_content, get_file_diff, get_file_tree,
    get_recent_projects, get_settings, get_tags, list_projects, open_project, rename_file,
    resolve_path, update_settings, validate_project,
};
use openmkview::AppState;

/// OpenMKView - Markdown file previewer
#[derive(Parser, Debug)]
#[command(
    name = "openmkview",
    version,
    about = "A Markdown file previewer with web UI"
)]
struct Cli {
    /// Host address to bind
    #[arg(long, env = "OPENMKVIEW_HOST", default_value = "0.0.0.0")]
    host: String,

    /// Port to listen on
    #[arg(short, long, env = "OPENMKVIEW_PORT", default_value_t = 4567)]
    port: u16,

    /// Number of HTTP worker threads
    #[arg(long, env = "OPENMKVIEW_WORKERS")]
    workers: Option<usize>,
}

async fn spa_index(_req: HttpRequest) -> Result<NamedFile> {
    NamedFile::open("./dist/index.html").map_err(actix_web::error::ErrorInternalServerError)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    let cli = Cli::parse();

    let db_path = if let Ok(path) = std::env::var("OPENMKVIEW_DB_PATH") {
        std::path::PathBuf::from(path)
    } else {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| std::env::current_dir().expect("无法获取当前目录"))
            .join("openmkview");
        std::fs::create_dir_all(&data_dir).expect("无法创建数据目录");
        data_dir.join("openmkview.db")
    };

    let conn = init_db(&db_path).expect("数据库初始化失败");

    log::info!("数据库初始化完成：{:?}", db_path);

    let app_state = web::Data::new(AppState {
        db: Arc::new(Mutex::new(conn)),
    });

    let bind_addr = format!("{}:{}", cli.host, cli.port);
    log::info!("服务器启动于 http://{}", bind_addr);

    let mut server = HttpServer::new(move || {
        App::new()
            .wrap(Logger::new(DEBUG_LOG_FORMAT).log_target("openmkview::http"))
            .app_data(app_state.clone())
            // API routes
            .route("/api/projects", web::get().to(list_projects))
            .route("/api/projects", web::post().to(create_project))
            .route("/api/projects/recent", web::get().to(get_recent_projects))
            .route("/api/projects/validate", web::post().to(validate_project))
            .route("/api/projects/open", web::post().to(open_project))
            .route("/api/projects/{id}", web::delete().to(delete_project))
            .route("/api/projects/resolve", web::post().to(resolve_path))
            .route("/api/files/tree", web::get().to(get_file_tree))
            .route("/api/files/content", web::get().to(get_file_content))
            .route("/api/files", web::post().to(create_file))
            .route("/api/files", web::put().to(rename_file))
            .route("/api/files", web::delete().to(delete_file))
            .route("/api/settings", web::get().to(get_settings))
            .route("/api/settings", web::put().to(update_settings))
            .route("/api/git", web::post().to(execute_git))
            .route("/api/git/commits", web::get().to(get_commits))
            .route("/api/git/branches", web::get().to(get_branches))
            .route("/api/git/tags", web::get().to(get_tags))
            .route("/api/git/diff", web::post().to(get_file_diff))
            .route("/api/git/file", web::get().to(get_file_at_ref))
            // Static files - serve from dist directory
            .service(Files::new("/assets", "./dist/assets"))
            // SPA fallback - serve index.html for frontend routes
            .route("/project/{id}", web::get().to(spa_index))
            .route("/project/{id}/files/{path:.*}", web::get().to(spa_index))
            .route("/", web::get().to(spa_index))
    })
    .bind(&bind_addr)?;

    if let Some(workers) = cli.workers {
        log::info!("使用 {} 个工作线程", workers);
        server = server.workers(workers);
    }

    server.run().await
}
