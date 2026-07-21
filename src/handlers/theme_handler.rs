use crate::errors::AppResult;
use crate::models::ThemeInstallRequest;
use crate::services::{delete_theme, get_all_themes, get_theme_css, install_theme};
use crate::AppState;
use actix_web::{web, HttpResponse};

pub async fn list_themes(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    let response = get_all_themes(&data.paths)?;
    Ok(HttpResponse::Ok().json(response))
}

pub async fn get_theme_css_content(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> AppResult<HttpResponse> {
    let theme_id = path.into_inner();
    let css = get_theme_css(&theme_id, &data.paths)?;
    Ok(HttpResponse::Ok().content_type("text/css").body(css))
}

pub async fn install_custom_theme(
    data: web::Data<AppState>,
    body: web::Json<ThemeInstallRequest>,
) -> AppResult<HttpResponse> {
    let request = body.into_inner();
    let theme = install_theme(&request.filename, &request.content, &data.paths)?;
    Ok(HttpResponse::Ok().json(theme))
}

pub async fn delete_custom_theme(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> AppResult<HttpResponse> {
    let theme_id = path.into_inner();
    delete_theme(&theme_id, &data.paths)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": format!("Theme '{}' deleted", theme_id)
    })))
}
