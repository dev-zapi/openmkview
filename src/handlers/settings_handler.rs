use crate::auth::update_session_timeout;
use crate::db::SettingsRepository;
use crate::errors::AppResult;
use crate::models::SystemSettings;
use crate::services::SettingsService;
use crate::AppState;
use actix_web::{web, HttpResponse};

pub async fn get_settings(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let settings_repo = SettingsRepository::new(&conn);
    let service = SettingsService::new(settings_repo);

    let settings = service.get_settings()?;
    Ok(HttpResponse::Ok().json(settings))
}

pub async fn update_settings(
    data: web::Data<AppState>,
    body: web::Json<SystemSettings>,
) -> AppResult<HttpResponse> {
    let conn = data.db.lock().unwrap();
    let settings_repo = SettingsRepository::new(&conn);
    let service = SettingsService::new(settings_repo);

    let settings = body.into_inner();
    service.save_settings(&settings)?;
    update_session_timeout(&data, settings.session_timeout_minutes)?;
    Ok(HttpResponse::Ok().json(settings))
}
