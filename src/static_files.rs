use actix_web::{HttpRequest, HttpResponse, HttpResponseBuilder, Result};

const CSP_HEADER: &str = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'";

fn add_csp(response: &mut HttpResponseBuilder) {
    response.insert_header(("Content-Security-Policy", CSP_HEADER));
}

/// PWA 缓存策略：
/// - index.html / manifest / service worker 本身必须每次协商，保证 autoUpdate 的更新检查畅通
/// - Vite 构建产物（assets/，文件名带内容哈希）长缓存
/// - 其余 public 资源（图标等）短缓存
fn cache_control_for(path: &str) -> &'static str {
    if path == "index.html" || path == "manifest.json" || path == "sw.js" || path == "registerSW.js"
    {
        "no-cache"
    } else if path.starts_with("assets/") {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=3600"
    }
}

fn add_cache_control(response: &mut HttpResponseBuilder, path: &str) {
    response.insert_header(("Cache-Control", cache_control_for(path)));
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
        add_cache_control(&mut resp, path);
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
            add_cache_control(&mut resp, "index.html");
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
            add_cache_control(&mut resp, path);
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
            add_cache_control(&mut resp, "index.html");
            add_csp(&mut resp);
            Ok(resp.body(content))
        }
        Err(_) => Ok(HttpResponse::NotFound().body("index.html not found")),
    }
}

#[cfg(test)]
mod tests {
    use super::cache_control_for;

    #[test]
    fn index_html_is_never_cached() {
        assert_eq!(cache_control_for("index.html"), "no-cache");
    }

    #[test]
    fn service_worker_files_are_never_cached() {
        assert_eq!(cache_control_for("sw.js"), "no-cache");
        assert_eq!(cache_control_for("registerSW.js"), "no-cache");
        assert_eq!(cache_control_for("manifest.json"), "no-cache");
    }

    #[test]
    fn hashed_assets_are_immutable() {
        assert_eq!(
            cache_control_for("assets/index-a1b2c3.js"),
            "public, max-age=31536000, immutable"
        );
    }

    #[test]
    fn other_public_files_get_short_cache() {
        assert_eq!(
            cache_control_for("icon-192x192.png"),
            "public, max-age=3600"
        );
    }
}
