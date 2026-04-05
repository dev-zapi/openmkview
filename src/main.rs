use actix_files::Files;
use actix_web::{web, App, HttpServer};
use clap::Parser;
use std::sync::{Arc, Mutex};

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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let cli = Cli::parse();

    let db_path = if let Ok(path) = std::env::var("OPENMKVIEW_DB_PATH") {
        std::path::PathBuf::from(path)
    } else {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let config_dir = std::path::PathBuf::from(home).join(".config/openmkview");
        std::fs::create_dir_all(&config_dir).expect("无法创建配置目录");
        config_dir.join("openmkview.db")
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
            .service(Files::new("/", "./dist").index_file("index.html"))
    })
    .bind(&bind_addr)?;

    if let Some(workers) = cli.workers {
        log::info!("使用 {} 个工作线程", workers);
        server = server.workers(workers);
    }

    server.run().await
}
