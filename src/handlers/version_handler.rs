use crate::errors::AppResult;
use actix_web::HttpResponse;
use serde::Serialize;

#[derive(Serialize)]
struct VersionResponse {
    version: String,
    build_time: String,
}

pub async fn get_version() -> AppResult<HttpResponse> {
    let version = env!("CARGO_PKG_VERSION");
    let git_hash = env!("GIT_SHORT_HASH");
    let build_time = env!("BUILD_TIME");
    let full_version = format!("v{}-{}", version, git_hash);

    Ok(HttpResponse::Ok().json(VersionResponse {
        version: full_version,
        build_time: build_time.to_string(),
    }))
}
