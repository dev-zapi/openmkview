use crate::config::{
    default_timeout_minutes, ensure_secret_key, load_config, save_config, verify_password,
    AppConfig, PasswordAlgorithm,
};
use crate::db::{hash_tool_session_token, ToolSessionRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{CreateToolSessionRequest, CreateToolSessionResponse};
use crate::paths::AppPaths;
use crate::AppState;
use actix_web::body::{EitherBody, MessageBody};
use actix_web::cookie::{time::Duration as CookieDuration, Cookie, SameSite};
use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::http::header;
use actix_web::{web, HttpRequest, HttpResponse};
use base64::Engine;
use chrono::Utc;
use hmac::{Hmac, Mac};
use rand::RngCore;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::future::{ready, Future, Ready};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};

const SESSION_COOKIE_NAME: &str = "openmkview_session";

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone)]
pub enum PasswordSource {
    Hashed,
    Plain,
}

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub username: String,
    pub password: String,
    pub algorithm: PasswordAlgorithm,
    pub source: PasswordSource,
}

#[derive(Debug, Clone)]
pub struct AuthState {
    pub config: AuthConfig,
    pub sessions: Arc<Mutex<HashMap<String, SessionRecord>>>,
    pub session_timeout_minutes: Arc<Mutex<u64>>,
    pub secret_key: Arc<Vec<u8>>,
    pub secure_cookies: bool,
}

#[derive(Debug, Clone)]
pub struct SessionRecord {
    pub issued_at: i64,
    pub last_seen_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatusResponse {
    pub auth_required: bool,
    pub authenticated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_timeout_minutes: Option<u64>,
    pub passkey_configured: bool,
    pub passkey_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passkey_origin: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSessionTimeoutRequest {
    #[serde(rename = "sessionTimeoutMinutes")]
    pub session_timeout_minutes: u64,
}

pub fn resolve_auth_config(
    cli_username: Option<String>,
    cli_password: Option<String>,
    file_config: &AppConfig,
) -> AppResult<Option<AuthConfig>> {
    let has_cli_username = cli_username.is_some();
    let has_cli_password = cli_password.is_some();
    let env_username = std::env::var("OPENMKVIEW_USERNAME").ok();
    let env_password = std::env::var("OPENMKVIEW_PASSWORD").ok();

    if let (Some(username), Some(password)) = (cli_username, cli_password) {
        return Ok(Some(AuthConfig {
            username,
            password,
            algorithm: file_config.auth.algorithm.clone(),
            source: PasswordSource::Plain,
        }));
    }

    if has_cli_username || has_cli_password {
        return Err(AppError::BadRequest(
            "用户名和密码必须同时通过命令行提供".to_string(),
        ));
    }

    if let (Some(username), Some(password)) = (env_username, env_password) {
        return Ok(Some(AuthConfig {
            username,
            password,
            algorithm: file_config.auth.algorithm.clone(),
            source: PasswordSource::Plain,
        }));
    }

    if std::env::var("OPENMKVIEW_USERNAME").is_ok() || std::env::var("OPENMKVIEW_PASSWORD").is_ok()
    {
        return Err(AppError::BadRequest(
            "用户名和密码必须同时通过环境变量提供".to_string(),
        ));
    }

    match (
        file_config.auth.username.clone(),
        file_config.auth.password_hash.clone(),
    ) {
        (Some(username), Some(password_hash)) => Ok(Some(AuthConfig {
            username,
            password: password_hash,
            algorithm: file_config.auth.algorithm.clone(),
            source: PasswordSource::Hashed,
        })),
        (None, None) => Ok(None),
        _ => Err(AppError::BadRequest(
            "配置文件中的用户名和密码必须同时存在".to_string(),
        )),
    }
}

pub fn build_auth_state(
    auth_config: AuthConfig,
    timeout_minutes: u64,
    secure_cookies: bool,
    paths: &AppPaths,
) -> AppResult<AuthState> {
    let mut config = load_config(paths)?;
    let secret_key = ensure_secret_key(&mut config, paths)?;

    if config.session.timeout_minutes == 0 {
        config.session.timeout_minutes = default_timeout_minutes();
        save_config(&config, paths)?;
    }

    Ok(AuthState {
        config: auth_config,
        sessions: Arc::new(Mutex::new(HashMap::new())),
        session_timeout_minutes: Arc::new(Mutex::new(timeout_minutes.max(1))),
        secret_key: Arc::new(secret_key),
        secure_cookies,
    })
}

pub fn update_session_timeout(app_state: &AppState, timeout_minutes: u64) -> AppResult<()> {
    let Some(auth) = &app_state.auth else {
        return Ok(());
    };

    *auth
        .session_timeout_minutes
        .lock()
        .map_err(|_| AppError::InternalError("session 状态已损坏".to_string()))? =
        timeout_minutes.max(1);

    let mut config = load_config(&app_state.paths)?;
    config.session.timeout_minutes = timeout_minutes.max(1);
    save_config(&config, &app_state.paths)
}

fn session_timeout_minutes(auth: &AuthState) -> AppResult<u64> {
    auth.session_timeout_minutes
        .lock()
        .map(|value| (*value).max(1))
        .map_err(|_| AppError::InternalError("session 状态已损坏".to_string()))
}

fn is_public_path(path: &str) -> bool {
    !path.starts_with("/api/")
        || path == "/api/auth/status"
        || path == "/api/auth/login"
        || path == "/api/auth/tool-sessions/exchange"
        || path == "/api/auth/passkey/login/start"
        || path == "/api/auth/passkey/login/finish"
        || path == "/api/version"
}

fn build_session_token(secret_key: &[u8]) -> AppResult<String> {
    let mut random = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut random);
    let payload = base64::engine::general_purpose::STANDARD.encode(random);

    let mut mac = HmacSha256::new_from_slice(secret_key)
        .map_err(|_| AppError::InternalError("session secret 无效".to_string()))?;
    mac.update(payload.as_bytes());
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    Ok(format!("{}.{}", payload, signature))
}

fn verify_session_signature(secret_key: &[u8], token: &str) -> bool {
    let Some((payload, signature)) = token.split_once('.') else {
        return false;
    };

    let Ok(signature_bytes) = base64::engine::general_purpose::STANDARD.decode(signature) else {
        return false;
    };

    let Ok(mut mac) = HmacSha256::new_from_slice(secret_key) else {
        return false;
    };
    mac.update(payload.as_bytes());
    mac.verify_slice(&signature_bytes).is_ok()
}

fn verify_login(auth: &AuthState, username: &str, password: &str) -> AppResult<bool> {
    if username != auth.config.username {
        return Ok(false);
    }

    match auth.config.source {
        PasswordSource::Hashed => verify_password(
            password,
            &auth.config.password,
            auth.config.algorithm.clone(),
        ),
        PasswordSource::Plain => Ok(password == auth.config.password),
    }
}

fn validate_session(auth: &AuthState, token: &str) -> AppResult<bool> {
    if !verify_session_signature(&auth.secret_key, token) {
        return Ok(false);
    }

    let timeout_seconds = (session_timeout_minutes(auth)? as i64) * 60;
    let now = Utc::now().timestamp();
    let mut sessions = auth
        .sessions
        .lock()
        .map_err(|_| AppError::InternalError("session 状态已损坏".to_string()))?;

    let is_valid = match sessions.get_mut(token) {
        Some(record) if now - record.last_seen_at <= timeout_seconds => {
            record.last_seen_at = now;
            true
        }
        Some(_) => {
            sessions.remove(token);
            false
        }
        None => false,
    };

    Ok(is_valid)
}

pub fn current_session_timeout_minutes(auth: &AuthState) -> AppResult<u64> {
    session_timeout_minutes(auth)
}

pub fn create_session_cookie(auth: &AuthState) -> AppResult<Cookie<'static>> {
    let token = build_session_token(&auth.secret_key)?;
    let now = Utc::now().timestamp();
    auth.sessions
        .lock()
        .map_err(|_| AppError::InternalError("session 状态已损坏".to_string()))?
        .insert(
            token.clone(),
            SessionRecord {
                issued_at: now,
                last_seen_at: now,
            },
        );

    let timeout_seconds = (session_timeout_minutes(auth)? as i64) * 60;
    let mut cookie = Cookie::build(SESSION_COOKIE_NAME, token)
        .path("/")
        .http_only(true)
        .same_site(SameSite::Strict)
        .max_age(CookieDuration::seconds(timeout_seconds));

    if auth.secure_cookies {
        cookie = cookie.secure(true);
    }

    Ok(cookie.finish())
}

fn passkey_status(data: &AppState, req: &HttpRequest) -> AppResult<(bool, bool, Option<String>)> {
    match &data.passkey {
        Some(passkey) => {
            let status = passkey.current_site_status(req)?;
            Ok((status.configured, status.has_credentials, status.origin))
        }
        None => Ok((false, false, None)),
    }
}

fn unauthorized_response<B>(req: ServiceRequest) -> ServiceResponse<EitherBody<B>>
where
    B: MessageBody + 'static,
{
    let wants_html = req
        .headers()
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("text/html"))
        .unwrap_or(false);

    let response = if wants_html {
        HttpResponse::Unauthorized().finish()
    } else {
        HttpResponse::Unauthorized().json(serde_json::json!({ "error": "未登录或登录已过期" }))
    };

    req.into_response(response).map_into_right_body()
}

pub async fn auth_status(data: web::Data<AppState>, req: HttpRequest) -> AppResult<HttpResponse> {
    let Some(auth) = &data.auth else {
        return Ok(HttpResponse::Ok().json(AuthStatusResponse {
            auth_required: false,
            authenticated: true,
            session_timeout_minutes: None,
            passkey_configured: false,
            passkey_available: false,
            passkey_origin: None,
        }));
    };

    let timeout_minutes = session_timeout_minutes(auth)?;
    let authenticated = if let Some(cookie) = req.cookie(SESSION_COOKIE_NAME) {
        validate_session(auth, cookie.value())?
    } else {
        false
    };

    let (passkey_configured, passkey_available, passkey_origin) = passkey_status(&data, &req)?;

    Ok(HttpResponse::Ok().json(AuthStatusResponse {
        auth_required: true,
        authenticated,
        session_timeout_minutes: Some(timeout_minutes),
        passkey_configured,
        passkey_available,
        passkey_origin,
    }))
}

pub async fn auth_login(
    data: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<LoginRequest>,
) -> AppResult<HttpResponse> {
    let Some(auth) = &data.auth else {
        return Ok(HttpResponse::Ok().json(AuthStatusResponse {
            auth_required: false,
            authenticated: true,
            session_timeout_minutes: None,
            passkey_configured: false,
            passkey_available: false,
            passkey_origin: None,
        }));
    };

    let body = body.into_inner();
    if !verify_login(auth, &body.username, &body.password)? {
        return Err(AppError::Unauthorized("用户名或密码错误".to_string()));
    }

    let cookie = create_session_cookie(auth)?;

    let (passkey_configured, passkey_available, passkey_origin) = passkey_status(&data, &req)?;

    Ok(HttpResponse::Ok().cookie(cookie).json(AuthStatusResponse {
        auth_required: true,
        authenticated: true,
        session_timeout_minutes: Some(session_timeout_minutes(auth)?),
        passkey_configured,
        passkey_available,
        passkey_origin,
    }))
}

pub async fn auth_update_session_timeout(
    data: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<UpdateSessionTimeoutRequest>,
) -> AppResult<HttpResponse> {
    if data.auth.is_none() {
        return Err(AppError::BadRequest("当前未启用登录认证".to_string()));
    }

    let timeout_minutes = body.session_timeout_minutes.max(1);
    update_session_timeout(&data, timeout_minutes)?;

    let (passkey_configured, passkey_available, passkey_origin) = passkey_status(&data, &req)?;

    Ok(HttpResponse::Ok().json(AuthStatusResponse {
        auth_required: true,
        authenticated: true,
        session_timeout_minutes: Some(timeout_minutes),
        passkey_configured,
        passkey_available,
        passkey_origin,
    }))
}

pub async fn auth_logout(data: web::Data<AppState>, req: HttpRequest) -> AppResult<HttpResponse> {
    let secure_cookies = if let Some(auth) = &data.auth {
        if let Some(cookie) = req.cookie(SESSION_COOKIE_NAME) {
            auth.sessions
                .lock()
                .map_err(|_| AppError::InternalError("session 状态已损坏".to_string()))?
                .remove(cookie.value());
        }
        auth.secure_cookies
    } else {
        false
    };

    let mut cookie = Cookie::build(SESSION_COOKIE_NAME, "")
        .path("/")
        .http_only(true)
        .same_site(SameSite::Strict)
        .max_age(CookieDuration::seconds(0));

    if secure_cookies {
        cookie = cookie.secure(true);
    }

    Ok(HttpResponse::Ok().cookie(cookie.finish()).finish())
}

fn build_tool_session_token() -> String {
    let mut random = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut random);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random)
}

fn lock_db(data: &AppState) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
    data.db
        .lock()
        .map_err(|_| AppError::InternalError("数据库状态已损坏".to_string()))
}

/// Exchanges credentials for a Tool Session token. This is the only place a
/// plaintext token is returned; only its SHA-256 hash is persisted.
pub async fn auth_tool_session_exchange(
    data: web::Data<AppState>,
    body: web::Json<CreateToolSessionRequest>,
) -> AppResult<HttpResponse> {
    let Some(auth) = &data.auth else {
        return Err(AppError::BadRequest("当前未启用登录认证".to_string()));
    };

    let body = body.into_inner();
    if !verify_login(auth, &body.username, &body.password)? {
        return Err(AppError::Unauthorized("用户名或密码错误".to_string()));
    }

    let label = body
        .label
        .as_deref()
        .map(str::trim)
        .filter(|label| !label.is_empty())
        .unwrap_or("Tool session")
        .to_string();
    let token = build_tool_session_token();
    let token_hash = hash_tool_session_token(&token);

    let conn = lock_db(&data)?;
    let session = ToolSessionRepository::new(&conn).create(&token_hash, &label)?;

    Ok(HttpResponse::Ok()
        .insert_header((header::CACHE_CONTROL, "no-store"))
        .json(CreateToolSessionResponse {
            id: session.id,
            label: session.label,
            token,
            created_at: session.created_at,
        }))
}

pub async fn auth_tool_session_list(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    if data.auth.is_none() {
        return Err(AppError::BadRequest("当前未启用登录认证".to_string()));
    }

    let conn = lock_db(&data)?;
    let sessions = ToolSessionRepository::new(&conn).list()?;
    Ok(HttpResponse::Ok().json(sessions))
}

pub async fn auth_tool_session_delete(
    data: web::Data<AppState>,
    id: web::Path<i64>,
) -> AppResult<HttpResponse> {
    if data.auth.is_none() {
        return Err(AppError::BadRequest("当前未启用登录认证".to_string()));
    }

    let conn = lock_db(&data)?;
    let deleted = ToolSessionRepository::new(&conn).delete(id.into_inner())?;
    if !deleted {
        return Err(AppError::NotFound("Tool Session 不存在".to_string()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

pub struct AuthMiddleware {
    auth: Arc<AuthState>,
    db: Arc<Mutex<Connection>>,
}

impl AuthMiddleware {
    pub fn new(auth: Arc<AuthState>, db: Arc<Mutex<Connection>>) -> Self {
        Self { auth, db }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = actix_web::Error;
    type InitError = ();
    type Transform = AuthMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service,
            auth: self.auth.clone(),
            db: self.db.clone(),
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: S,
    auth: Arc<AuthState>,
    db: Arc<Mutex<Connection>>,
}

fn bearer_token(req: &ServiceRequest) -> Option<String> {
    let header_value = req.headers().get(header::AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = header_value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }

    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

/// Validates a Tool Session token against the database. Sessions never expire,
/// so existence is the only validity condition; revocation deletes the row.
fn validate_tool_session(db: &Arc<Mutex<Connection>>, token: &str) -> AppResult<bool> {
    let token_hash = hash_tool_session_token(token);
    let conn = db
        .lock()
        .map_err(|_| AppError::InternalError("数据库状态已损坏".to_string()))?;
    let repo = ToolSessionRepository::new(&conn);

    match repo.find_by_token_hash(&token_hash)? {
        Some(session) => {
            repo.touch_last_used(session.id)?;
            Ok(true)
        }
        None => Ok(false),
    }
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = actix_web::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, ctx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        if is_public_path(req.path()) {
            let fut = self.service.call(req);
            return Box::pin(async move { fut.await.map(ServiceResponse::map_into_left_body) });
        }

        let token = req
            .cookie(SESSION_COOKIE_NAME)
            .map(|cookie| cookie.value().to_string());
        let auth = self.auth.clone();

        if let Some(token) = token {
            match validate_session(&auth, &token) {
                Ok(true) => {
                    let fut = self.service.call(req);
                    return Box::pin(
                        async move { fut.await.map(ServiceResponse::map_into_left_body) },
                    );
                }
                Ok(false) => {}
                Err(err) => {
                    return Box::pin(async move {
                        Err(actix_web::error::ErrorInternalServerError(err))
                    });
                }
            }
        }

        if let Some(token) = bearer_token(&req) {
            let db = self.db.clone();
            match validate_tool_session(&db, &token) {
                Ok(true) => {
                    let fut = self.service.call(req);
                    return Box::pin(
                        async move { fut.await.map(ServiceResponse::map_into_left_body) },
                    );
                }
                Ok(false) => {}
                Err(err) => {
                    return Box::pin(async move {
                        Err(actix_web::error::ErrorInternalServerError(err))
                    });
                }
            }
        }

        Box::pin(async move { Ok(unauthorized_response::<B>(req)) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use actix_web::body::BoxBody;
    use actix_web::dev::ServiceResponse;
    use actix_web::http::header;
    use actix_web::{test as awtest, web, App, HttpResponse};
    use serde_json::{json, Value};
    use tempfile::TempDir;

    type TestResponse = ServiceResponse<EitherBody<BoxBody>>;

    fn default_auth_config() -> AuthConfig {
        AuthConfig {
            username: "alice".to_string(),
            password: "correct horse".to_string(),
            algorithm: PasswordAlgorithm::Argon2,
            source: PasswordSource::Plain,
        }
    }

    macro_rules! init_test_app {
        ($temp_dir:expr) => {{
            let temp_dir: &TempDir = $temp_dir;
            let paths = AppPaths {
                config_dir: temp_dir.path().join("config"),
                data_dir: temp_dir.path().join("data"),
            };
            paths.ensure_dirs().expect("create app paths");
            let db_path = temp_dir.path().join("openmkview.db");
            let conn = init_db(&db_path).expect("init db");
            let auth = Arc::new(
                build_auth_state(default_auth_config(), 60, false, &paths)
                    .expect("build auth state"),
            );
            let db = Arc::new(Mutex::new(conn));
            let state = AppState {
                db: db.clone(),
                auth: Some(auth.clone()),
                passkey: None,
                paths: Arc::new(paths),
            };

            awtest::init_service(
                App::new()
                    .wrap(AuthMiddleware::new(auth, db))
                    .app_data(web::Data::new(state))
                    .route("/api/auth/login", web::post().to(auth_login))
                    .route(
                        "/api/auth/tool-sessions/exchange",
                        web::post().to(auth_tool_session_exchange),
                    )
                    .route(
                        "/api/auth/tool-sessions",
                        web::get().to(auth_tool_session_list),
                    )
                    .route(
                        "/api/auth/tool-sessions/{id}",
                        web::delete().to(auth_tool_session_delete),
                    )
                    .route("/api/protected", web::get().to(protected_probe)),
            )
            .await
        }};
    }

    async fn protected_probe() -> HttpResponse {
        HttpResponse::Ok().json(json!({ "ok": true }))
    }

    async fn send<S, R>(app: &S, req: R) -> TestResponse
    where
        S: Service<R, Response = TestResponse, Error = actix_web::Error>,
    {
        awtest::call_service(app, req).await
    }

    fn exchange_request(username: &str, password: &str, label: &str) -> awtest::TestRequest {
        awtest::TestRequest::post()
            .uri("/api/auth/tool-sessions/exchange")
            .set_json(json!({
                "username": username,
                "password": password,
                "label": label,
            }))
    }

    fn protected_request(bearer: Option<&str>) -> awtest::TestRequest {
        let mut req = awtest::TestRequest::get().uri("/api/protected");
        if let Some(token) = bearer {
            req = req.insert_header((header::AUTHORIZATION, format!("Bearer {token}")));
        }
        req
    }

    async fn body_json(response: TestResponse) -> Value {
        let bytes = actix_web::body::to_bytes(response.into_body())
            .await
            .expect("body bytes");
        serde_json::from_slice(&bytes).expect("json body")
    }

    #[test]
    fn tool_session_endpoints_are_protected_except_exchange() {
        assert!(is_public_path("/api/auth/tool-sessions/exchange"));
        assert!(!is_public_path("/api/auth/tool-sessions"));
        assert!(!is_public_path("/api/auth/tool-sessions/7"));
    }

    #[test]
    fn annotation_api_is_not_public() {
        assert!(!is_public_path("/api/annotations"));
        assert!(!is_public_path("/api/annotations/42"));
    }

    #[test]
    fn version_api_is_public_for_login_page() {
        assert!(is_public_path("/api/version"));
    }

    #[actix_web::test]
    async fn credential_exchange_issues_a_usable_bearer_token() {
        let temp_dir = TempDir::new().expect("temp dir");
        let app = init_test_app!(&temp_dir);

        let response = send(
            &app,
            exchange_request("alice", "correct horse", "laptop").to_request(),
        )
        .await;
        assert_eq!(response.status(), actix_web::http::StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CACHE_CONTROL)
                .expect("exchange response is not cacheable"),
            "no-store"
        );
        let body = body_json(response).await;
        let token = body["token"]
            .as_str()
            .expect("token in response")
            .to_string();
        assert_eq!(body["label"], "laptop");

        let authenticated = send(&app, protected_request(Some(&token)).to_request()).await;
        assert_eq!(authenticated.status(), actix_web::http::StatusCode::OK);

        let unauthenticated = send(&app, protected_request(None).to_request()).await;
        assert_eq!(
            unauthenticated.status(),
            actix_web::http::StatusCode::UNAUTHORIZED
        );

        let list_req = awtest::TestRequest::get()
            .uri("/api/auth/tool-sessions")
            .insert_header((header::AUTHORIZATION, format!("Bearer {token}")))
            .to_request();
        let list_response = send(&app, list_req).await;
        assert_eq!(list_response.status(), actix_web::http::StatusCode::OK);
        let sessions = body_json(list_response).await;
        assert_eq!(sessions.as_array().expect("session array").len(), 1);
        assert_eq!(sessions[0]["label"], "laptop");

        // Only the hash is persisted.
        let conn = init_db(&temp_dir.path().join("openmkview.db")).expect("reopen db");
        let stored_hash: String = conn
            .query_row("SELECT token_hash FROM tool_sessions", [], |row| row.get(0))
            .expect("stored hash");
        assert_ne!(stored_hash, token);
        assert_eq!(stored_hash, crate::db::hash_tool_session_token(&token));
    }

    #[actix_web::test]
    async fn wrong_credentials_are_rejected_without_creating_a_session() {
        let temp_dir = TempDir::new().expect("temp dir");
        let app = init_test_app!(&temp_dir);

        let response = send(
            &app,
            exchange_request("alice", "wrong password", "laptop").to_request(),
        )
        .await;
        assert_eq!(response.status(), actix_web::http::StatusCode::UNAUTHORIZED);

        let conn = init_db(&temp_dir.path().join("openmkview.db")).expect("reopen db");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tool_sessions", [], |row| row.get(0))
            .expect("count sessions");
        assert_eq!(count, 0);
    }

    #[actix_web::test]
    async fn revoked_token_is_rejected_on_next_use() {
        let temp_dir = TempDir::new().expect("temp dir");
        let app = init_test_app!(&temp_dir);

        let response = send(
            &app,
            exchange_request("alice", "correct horse", "laptop").to_request(),
        )
        .await;
        let body = body_json(response).await;
        let token = body["token"].as_str().expect("token").to_string();
        let id = body["id"].as_i64().expect("session id");

        let delete_req = awtest::TestRequest::delete()
            .uri(&format!("/api/auth/tool-sessions/{id}"))
            .insert_header((header::AUTHORIZATION, format!("Bearer {token}")))
            .to_request();
        let delete_response = send(&app, delete_req).await;
        assert_eq!(delete_response.status(), actix_web::http::StatusCode::OK);

        let revoked = send(&app, protected_request(Some(&token)).to_request()).await;
        assert_eq!(revoked.status(), actix_web::http::StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn tool_session_token_survives_a_server_restart() {
        let temp_dir = TempDir::new().expect("temp dir");
        let token = {
            let app = init_test_app!(&temp_dir);
            let response = send(
                &app,
                exchange_request("alice", "correct horse", "survivor").to_request(),
            )
            .await;
            let body = body_json(response).await;
            body["token"].as_str().expect("token").to_string()
        };

        // A fresh AppState with a freshly opened SQLite connection models a restart.
        let restarted = init_test_app!(&temp_dir);
        let response = send(&restarted, protected_request(Some(&token)).to_request()).await;
        assert_eq!(response.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn unknown_bearer_token_is_rejected() {
        let temp_dir = TempDir::new().expect("temp dir");
        let app = init_test_app!(&temp_dir);

        let response = send(
            &app,
            protected_request(Some("never-issued-token")).to_request(),
        )
        .await;
        assert_eq!(response.status(), actix_web::http::StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn cookie_login_still_authenticates_api_requests() {
        let temp_dir = TempDir::new().expect("temp dir");
        let app = init_test_app!(&temp_dir);

        let login_req = awtest::TestRequest::post()
            .uri("/api/auth/login")
            .set_json(json!({ "username": "alice", "password": "correct horse" }))
            .to_request();
        let login_response = send(&app, login_req).await;
        assert_eq!(login_response.status(), actix_web::http::StatusCode::OK);

        let cookie_header = login_response
            .headers()
            .get(header::SET_COOKIE)
            .expect("session cookie")
            .to_str()
            .expect("cookie header string");
        let session_token = cookie_header
            .split(';')
            .next()
            .and_then(|pair| pair.split_once('='))
            .map(|(_, value)| value.to_string())
            .expect("session token value");

        let req = awtest::TestRequest::get()
            .uri("/api/protected")
            .cookie(Cookie::new(SESSION_COOKIE_NAME, session_token))
            .to_request();
        let response = send(&app, req).await;
        assert_eq!(response.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn tool_session_management_requires_authentication() {
        let temp_dir = TempDir::new().expect("temp dir");
        let app = init_test_app!(&temp_dir);

        let list_response = send(
            &app,
            awtest::TestRequest::get()
                .uri("/api/auth/tool-sessions")
                .to_request(),
        )
        .await;
        assert_eq!(
            list_response.status(),
            actix_web::http::StatusCode::UNAUTHORIZED
        );

        let delete_response = send(
            &app,
            awtest::TestRequest::delete()
                .uri("/api/auth/tool-sessions/42")
                .to_request(),
        )
        .await;
        assert_eq!(
            delete_response.status(),
            actix_web::http::StatusCode::UNAUTHORIZED
        );
    }
}
