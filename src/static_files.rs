use actix_web::{HttpRequest, HttpResponse, Result};

#[cfg(not(debug_assertions))]
use rust_embed::RustEmbed;

#[cfg(not(debug_assertions))]
#[derive(RustEmbed)]
#[folder = "dist/"]
pub struct StaticAssets;

#[cfg(not(debug_assertions))]
pub fn get_static_file(path: &str) -> Option<(Vec<u8>, String)> {
    StaticAssets::get(path).map(|file| {
        let mime_type = mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string();
        (file.data.to_vec(), mime_type)
    })
}

#[cfg(not(debug_assertions))]
pub async fn serve_static(req: HttpRequest) -> Result<HttpResponse> {
    let path = req.match_info().query("path");

    if path.is_empty() || path == "/" {
        return serve_index().await;
    }

    let path = path.trim_start_matches('/');

    if let Some((content, mime_type)) = get_static_file(path) {
        return Ok(HttpResponse::Ok().content_type(mime_type).body(content));
    }

    serve_index().await
}

#[cfg(not(debug_assertions))]
pub async fn serve_index() -> Result<HttpResponse> {
    match get_static_file("index.html") {
        Some((content, mime_type)) => Ok(HttpResponse::Ok().content_type(mime_type).body(content)),
        None => Ok(HttpResponse::NotFound().body("index.html not found")),
    }
}

#[cfg(debug_assertions)]
pub async fn serve_static(req: HttpRequest) -> Result<HttpResponse> {
    let path = req.match_info().query("path");

    if path.is_empty() || path == "/" {
        return serve_index().await;
    }

    let path = path.trim_start_matches('/');
    let file_path = format!("./dist/{}", path);

    match std::fs::read(&file_path) {
        Ok(content) => {
            let mime_type = mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string();
            Ok(HttpResponse::Ok().content_type(mime_type).body(content))
        }
        Err(_) => serve_index().await,
    }
}

#[cfg(debug_assertions)]
pub async fn serve_index() -> Result<HttpResponse> {
    match std::fs::read("./dist/index.html") {
        Ok(content) => Ok(HttpResponse::Ok().content_type("text/html").body(content)),
        Err(_) => Ok(HttpResponse::NotFound().body("index.html not found")),
    }
}
