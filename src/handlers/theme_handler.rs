use crate::errors::AppResult;
use crate::models::ThemeInstallRequest;
use crate::services::{delete_theme, get_all_themes, get_theme_css, install_theme};
use actix_web::{web, HttpResponse};

pub async fn list_themes() -> AppResult<HttpResponse> {
    let response = get_all_themes()?;
    Ok(HttpResponse::Ok().json(response))
}

pub async fn get_theme_css_content(path: web::Path<String>) -> AppResult<HttpResponse> {
    let theme_id = path.into_inner();
    let css = get_theme_css(&theme_id)?;
    Ok(HttpResponse::Ok().content_type("text/css").body(css))
}

pub async fn install_custom_theme(body: web::Json<ThemeInstallRequest>) -> AppResult<HttpResponse> {
    let request = body.into_inner();
    let theme = install_theme(&request.filename, &request.content)?;
    Ok(HttpResponse::Ok().json(theme))
}

pub async fn delete_custom_theme(path: web::Path<String>) -> AppResult<HttpResponse> {
    let theme_id = path.into_inner();
    delete_theme(&theme_id)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": format!("Theme '{}' deleted", theme_id)
    })))
}
