use actix_web::{HttpRequest, HttpResponse, HttpResponseBuilder, Result};

const CSP_HEADER: &str = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'";

fn add_csp(response: &mut HttpResponseBuilder) {
    response.insert_header(("Content-Security-Policy", CSP_HEADER));
}

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
        let mut resp = HttpResponse::Ok();
        resp.content_type(&*mime_type);
        if mime_type == "text/html" {
            add_csp(&mut resp);
        }
        return Ok(resp.body(content));
    }

    serve_index().await
}

#[cfg(not(debug_assertions))]
pub async fn serve_index() -> Result<HttpResponse> {
    match get_static_file("index.html") {
        Some((content, mime_type)) => {
            let mut resp = HttpResponse::Ok();
            resp.content_type(mime_type);
            add_csp(&mut resp);
            Ok(resp.body(content))
        }
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
            let mut resp = HttpResponse::Ok();
            resp.content_type(&*mime_type);
            if mime_type == "text/html" {
                add_csp(&mut resp);
            }
            Ok(resp.body(content))
        }
        Err(_) => serve_index().await,
    }
}

#[cfg(debug_assertions)]
pub async fn serve_index() -> Result<HttpResponse> {
    match std::fs::read("./dist/index.html") {
        Ok(content) => {
            let mut resp = HttpResponse::Ok();
            resp.content_type("text/html");
            add_csp(&mut resp);
            Ok(resp.body(content))
        }
        Err(_) => Ok(HttpResponse::NotFound().body("index.html not found")),
    }
}
