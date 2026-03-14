mod handlers;

use axum::{
    extract::State,
    routing::{get, post},
    Router,
};
use openmkview::{AppState, db::Database};
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::handlers::{files, git, projects, settings};

#[tokio::main]
async fn main() {
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "openmkview=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // 获取数据目录路径
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let data_dir = cwd.join("data");
    
    // 确保数据目录存在
    std::fs::create_dir_all(&data_dir).expect("无法创建数据目录");
    
    // 初始化数据库
    let db_path = data_dir.join("openmkview.db");
    let db = Database::new(db_path.to_str().unwrap())
        .expect("无法初始化数据库");
    
    tracing::info!("数据库初始化完成：{:?}", db_path);
    
    // 构建应用状态
    let state = AppState {
        db: Arc::new(db),
    };
    
    // 构建路由
    let app = create_app(state);
    
    // 启动服务器
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("无法绑定端口 3000");
    
    tracing::info!("服务器启动于 http://0.0.0.0:3000");
    
    axum::serve(listener, app).await.unwrap();
}

/// 创建应用路由
fn create_app(state: AppState) -> Router {
    let api_routes = Router::new()
        .nest("/projects", projects::router())
        .nest("/files", files::router())
        .nest("/settings", settings::router())
        .nest("/git", git::router())
        .with_state(state.clone());
    
    let app = Router::new()
        .nest("/api", api_routes)
        .route("/", get(root_handler))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);
    
    app
}

/// 根路径处理器
async fn root_handler() -> &'static str {
    "OpenMKView Rust Server v0.2.0"
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http::{Request, StatusCode};
    use openmkview::db::Database;
    use tower::ServiceExt;
    
    #[tokio::test]
    async fn test_root_handler() {
        let db = Database::in_memory().unwrap();
        let state = AppState {
            db: Arc::new(db),
        };
        let app = create_app(state);
        
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
    }
}
