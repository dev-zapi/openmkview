use crate::auth::{
    create_session_cookie, current_session_timeout_minutes, AuthState, AuthStatusResponse,
    PasswordSource,
};
use crate::errors::{AppError, AppResult};
use crate::AppState;
use actix_web::{web, HttpRequest, HttpResponse};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use webauthn_rs::prelude::*;

const DEFAULT_CEREMONY_TIMEOUT_SECONDS: u64 = 300;
const PASSKEY_RP_NAME: &str = "OpenMKView";
const MAX_PENDING_CHALLENGES: usize = 100;

#[derive(Debug, Clone)]
pub struct PasskeyState {
    site: PasskeySiteConfig,
    store_path: PathBuf,
    store: Arc<Mutex<PasskeyStoreData>>,
    registration_challenges: Arc<Mutex<HashMap<String, ChallengeRecord<PasskeyRegistration>>>>,
    authentication_challenges: Arc<Mutex<HashMap<String, ChallengeRecord<PasskeyAuthentication>>>>,
    ceremony_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyCredentialSummary {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyListResponse {
    pub credentials: Vec<PasskeyCredentialSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CeremonyStartResponse<T> {
    request_id: String,
    options: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PasskeyStoreData {
    #[serde(default)]
    auth_binding: String,
    user_id: String,
    #[serde(default)]
    credentials: Vec<StoredPasskey>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredPasskey {
    id: String,
    name: String,
    created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_used_at: Option<DateTime<Utc>>,
    passkey: Passkey,
}

#[derive(Debug, Clone)]
pub struct PasskeySiteConfig {
    rp_id: String,
    origin: String,
}

#[derive(Debug, Clone)]
struct ChallengeRecord<T> {
    started_at: DateTime<Utc>,
    site: PasskeySiteConfig,
    state: T,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegisterFinishRequest {
    pub request_id: String,
    pub credential: RegisterPublicKeyCredential,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyLoginFinishRequest {
    pub request_id: String,
    pub credential: PublicKeyCredential,
}

pub fn build_passkey_state(auth: &AuthState, site: PasskeySiteConfig) -> AppResult<PasskeyState> {
    let store_path = passkey_store_path()?;
    if let Some(parent) = store_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut store = load_store(&store_path)?;
    let auth_binding = build_auth_binding(auth);
    if store.user_id.is_empty() {
        store.user_id = Uuid::new_v4().to_string();
    }
    if store.auth_binding != auth_binding {
        store.auth_binding = auth_binding;
        store.user_id = Uuid::new_v4().to_string();
        store.credentials.clear();
        save_store_to_path(&store_path, &store)?;
    }

    Ok(PasskeyState {
        site,
        store: Arc::new(Mutex::new(store)),
        store_path,
        registration_challenges: Arc::new(Mutex::new(HashMap::new())),
        authentication_challenges: Arc::new(Mutex::new(HashMap::new())),
        ceremony_timeout_seconds: DEFAULT_CEREMONY_TIMEOUT_SECONDS,
    })
}

impl PasskeyState {
    pub fn has_credentials(&self) -> AppResult<bool> {
        Ok(!self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?
            .credentials
            .is_empty())
    }

    pub fn list_credentials(&self) -> AppResult<Vec<PasskeyCredentialSummary>> {
        let store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;
        Ok(summarize_credentials(&store))
    }

    fn start_registration(
        &self,
        auth: &crate::auth::AuthState,
        req: &HttpRequest,
    ) -> AppResult<CeremonyStartResponse<CreationChallengeResponse>> {
        ensure_request_origin(req, &self.site)?;
        let webauthn = build_webauthn(&self.site, self.ceremony_timeout_seconds)?;
        let user_id = self.user_uuid()?;
        let exclude_credentials = self.exclude_credentials()?;

        let (options, state) = webauthn
            .start_passkey_registration(
                user_id,
                &auth.config.username,
                &auth.config.username,
                exclude_credentials,
            )
            .map_err(|err| {
                log::warn!("passkey registration start failed: {}", err);
                AppError::BadRequest(
                    "无法开始 Passkey 注册，请确认当前访问地址可用于 Passkey".to_string(),
                )
            })?;

        self.cleanup_registration_challenges()?;
        self.enforce_challenge_limit(&self.registration_challenges)?;

        let request_id = Uuid::new_v4().to_string();
        self.registration_challenges
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?
            .insert(
                request_id.clone(),
                ChallengeRecord {
                    started_at: Utc::now(),
                    site: self.site.clone(),
                    state,
                },
            );

        Ok(CeremonyStartResponse {
            request_id,
            options,
        })
    }

    fn finish_registration(
        &self,
        body: PasskeyRegisterFinishRequest,
    ) -> AppResult<Vec<PasskeyCredentialSummary>> {
        let challenge = take_challenge(
            &self.registration_challenges,
            &body.request_id,
            self.ceremony_timeout_seconds,
            "Passkey 注册请求已过期，请重试",
        )?;
        let webauthn = build_webauthn(&challenge.site, self.ceremony_timeout_seconds)?;
        let passkey = webauthn
            .finish_passkey_registration(&body.credential, &challenge.state)
            .map_err(|err| {
                log::warn!("passkey registration finish failed: {}", err);
                AppError::BadRequest("Passkey 注册失败，请重试".to_string())
            })?;
        let credential_id = credential_id_string(passkey.cred_id().as_ref());
        let credential_name = normalize_passkey_name(body.name);
        let now = Utc::now();

        let mut store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;

        if store
            .credentials
            .iter()
            .any(|item| item.id == credential_id)
        {
            return Err(AppError::Conflict("该 Passkey 已经注册过了".to_string()));
        }

        store.credentials.push(StoredPasskey {
            id: credential_id,
            name: credential_name,
            created_at: now,
            last_used_at: None,
            passkey,
        });

        self.save_store(&store)?;
        Ok(summarize_credentials(&store))
    }

    fn start_authentication(
        &self,
        req: &HttpRequest,
    ) -> AppResult<CeremonyStartResponse<RequestChallengeResponse>> {
        let credentials = self.registered_passkeys()?;
        if credentials.is_empty() {
            return Err(AppError::BadRequest("当前没有可用的 Passkey".to_string()));
        }

        ensure_request_origin(req, &self.site)?;
        let webauthn = build_webauthn(&self.site, self.ceremony_timeout_seconds)?;
        let (options, state) = webauthn
            .start_passkey_authentication(&credentials)
            .map_err(|err| {
                log::warn!("passkey authentication start failed: {}", err);
                AppError::BadRequest("无法开始 Passkey 登录，请稍后重试".to_string())
            })?;

        self.cleanup_authentication_challenges()?;
        self.enforce_challenge_limit(&self.authentication_challenges)?;

        let request_id = Uuid::new_v4().to_string();
        self.authentication_challenges
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?
            .insert(
                request_id.clone(),
                ChallengeRecord {
                    started_at: Utc::now(),
                    site: self.site.clone(),
                    state,
                },
            );

        Ok(CeremonyStartResponse {
            request_id,
            options,
        })
    }

    fn finish_authentication(&self, body: PasskeyLoginFinishRequest) -> AppResult<()> {
        let challenge = take_challenge(
            &self.authentication_challenges,
            &body.request_id,
            self.ceremony_timeout_seconds,
            "Passkey 登录请求已过期，请重试",
        )?;
        let webauthn = build_webauthn(&challenge.site, self.ceremony_timeout_seconds)?;
        let result = webauthn
            .finish_passkey_authentication(&body.credential, &challenge.state)
            .map_err(|err| {
                log::warn!("passkey authentication finish failed: {}", err);
                AppError::Unauthorized("Passkey 验证失败".to_string())
            })?;

        let credential_id = credential_id_string(body.credential.get_credential_id());
        let mut store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;
        let credential = store
            .credentials
            .iter_mut()
            .find(|item| item.id == credential_id)
            .ok_or_else(|| AppError::Unauthorized("Passkey 验证失败".to_string()))?;

        if result.needs_update() {
            let _ = credential.passkey.update_credential(&result);
        }

        credential.last_used_at = Some(Utc::now());
        self.save_store(&store)?;

        Ok(())
    }

    fn delete_credential(&self, credential_id: &str) -> AppResult<Vec<PasskeyCredentialSummary>> {
        let mut store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;
        let before = store.credentials.len();
        store.credentials.retain(|item| item.id != credential_id);

        if before == store.credentials.len() {
            return Err(AppError::NotFound("指定的 Passkey 不存在".to_string()));
        }

        self.save_store(&store)?;
        Ok(summarize_credentials(&store))
    }

    fn registered_passkeys(&self) -> AppResult<Vec<Passkey>> {
        let store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;
        Ok(store
            .credentials
            .iter()
            .map(|item| item.passkey.clone())
            .collect())
    }

    fn exclude_credentials(&self) -> AppResult<Option<Vec<CredentialID>>> {
        let store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;
        let credentials: Vec<CredentialID> = store
            .credentials
            .iter()
            .map(|item| item.passkey.cred_id().clone())
            .collect();

        if credentials.is_empty() {
            Ok(None)
        } else {
            Ok(Some(credentials))
        }
    }

    fn user_uuid(&self) -> AppResult<Uuid> {
        let mut store = self
            .store
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?;

        match Uuid::parse_str(&store.user_id) {
            Ok(uuid) => Ok(uuid),
            Err(_) => {
                let uuid = Uuid::new_v4();
                store.user_id = uuid.to_string();
                self.save_store(&store)?;
                Ok(uuid)
            }
        }
    }

    fn cleanup_registration_challenges(&self) -> AppResult<()> {
        cleanup_challenges(&self.registration_challenges, self.ceremony_timeout_seconds)
    }

    fn cleanup_authentication_challenges(&self) -> AppResult<()> {
        cleanup_challenges(
            &self.authentication_challenges,
            self.ceremony_timeout_seconds,
        )
    }

    fn enforce_challenge_limit<T>(
        &self,
        entries: &Arc<Mutex<HashMap<String, ChallengeRecord<T>>>>,
    ) -> AppResult<()> {
        let count = entries
            .lock()
            .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?
            .len();
        if count >= MAX_PENDING_CHALLENGES {
            return Err(AppError::BadRequest("请求过于频繁，请稍后重试".to_string()));
        }
        Ok(())
    }

    fn save_store(&self, store: &PasskeyStoreData) -> AppResult<()> {
        save_store_to_path(&self.store_path, store)
    }
}

pub async fn passkey_register_start(
    data: web::Data<AppState>,
    req: HttpRequest,
) -> AppResult<HttpResponse> {
    let auth = data
        .auth
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用登录认证".to_string()))?;
    let passkey = data
        .passkey
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用 Passkey".to_string()))?;

    Ok(HttpResponse::Ok().json(passkey.start_registration(auth, &req)?))
}

pub async fn passkey_register_finish(
    data: web::Data<AppState>,
    body: web::Json<PasskeyRegisterFinishRequest>,
) -> AppResult<HttpResponse> {
    let passkey = data
        .passkey
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用 Passkey".to_string()))?;
    let credentials = passkey.finish_registration(body.into_inner())?;

    Ok(HttpResponse::Ok().json(PasskeyListResponse { credentials }))
}

pub async fn passkey_login_start(
    data: web::Data<AppState>,
    req: HttpRequest,
) -> AppResult<HttpResponse> {
    let passkey = data
        .passkey
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用 Passkey".to_string()))?;

    Ok(HttpResponse::Ok().json(passkey.start_authentication(&req)?))
}

pub async fn passkey_login_finish(
    data: web::Data<AppState>,
    body: web::Json<PasskeyLoginFinishRequest>,
) -> AppResult<HttpResponse> {
    let auth = data
        .auth
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用登录认证".to_string()))?;
    let passkey = data
        .passkey
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用 Passkey".to_string()))?;

    passkey.finish_authentication(body.into_inner())?;
    let cookie = create_session_cookie(auth)?;

    Ok(HttpResponse::Ok().cookie(cookie).json(AuthStatusResponse {
        auth_required: true,
        authenticated: true,
        session_timeout_minutes: Some(current_session_timeout_minutes(auth)?),
        passkey_available: passkey.has_credentials()?,
    }))
}

pub async fn passkey_list(data: web::Data<AppState>) -> AppResult<HttpResponse> {
    let passkey = data
        .passkey
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用 Passkey".to_string()))?;

    Ok(HttpResponse::Ok().json(PasskeyListResponse {
        credentials: passkey.list_credentials()?,
    }))
}

pub async fn passkey_delete(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> AppResult<HttpResponse> {
    let passkey = data
        .passkey
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("当前未启用 Passkey".to_string()))?;
    let credentials = passkey.delete_credential(&path.into_inner())?;

    Ok(HttpResponse::Ok().json(PasskeyListResponse { credentials }))
}

fn passkey_store_path() -> AppResult<PathBuf> {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or(std::env::current_dir()?);
    Ok(base.join("openmkview").join("passkeys.json"))
}

fn load_store(path: &PathBuf) -> AppResult<PasskeyStoreData> {
    if !path.exists() {
        return Ok(PasskeyStoreData {
            auth_binding: String::new(),
            user_id: Uuid::new_v4().to_string(),
            credentials: Vec::new(),
        });
    }

    let content = fs::read_to_string(path)?;
    match serde_json::from_str(&content) {
        Ok(store) => Ok(store),
        Err(err) => {
            let backup_path =
                path.with_extension(format!("broken-{}.json", Utc::now().format("%Y%m%d%H%M%S")));
            fs::rename(path, &backup_path)?;
            log::warn!("invalid passkey store moved to {:?}: {}", backup_path, err);
            Ok(PasskeyStoreData {
                auth_binding: String::new(),
                user_id: Uuid::new_v4().to_string(),
                credentials: Vec::new(),
            })
        }
    }
}

fn summarize_credentials(store: &PasskeyStoreData) -> Vec<PasskeyCredentialSummary> {
    let mut credentials: Vec<PasskeyCredentialSummary> = store
        .credentials
        .iter()
        .map(|item| PasskeyCredentialSummary {
            id: item.id.clone(),
            name: item.name.clone(),
            created_at: item.created_at,
            last_used_at: item.last_used_at,
        })
        .collect();
    credentials.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    credentials
}

fn normalize_passkey_name(name: Option<String>) -> String {
    let trimmed = name.unwrap_or_default().trim().to_string();
    if trimmed.is_empty() {
        return "This device".to_string();
    }

    trimmed.chars().take(80).collect()
}

fn credential_id_string(value: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(value)
}

pub fn build_passkey_site(origin: &str) -> AppResult<PasskeySiteConfig> {
    let parsed_origin = Url::parse(origin)
        .map_err(|_| AppError::BadRequest("Passkey 访问地址配置无效".to_string()))?;

    if !matches!(parsed_origin.scheme(), "http" | "https")
        || parsed_origin.query().is_some()
        || parsed_origin.fragment().is_some()
        || !parsed_origin.username().is_empty()
        || parsed_origin.password().is_some()
        || parsed_origin.path() != "/"
    {
        return Err(AppError::BadRequest("Passkey 访问地址配置无效".to_string()));
    }

    let rp_id = parsed_origin
        .host_str()
        .ok_or_else(|| AppError::BadRequest("Passkey 访问地址配置无效".to_string()))?;

    let site = PasskeySiteConfig {
        rp_id: rp_id.to_string(),
        origin: parsed_origin.to_string(),
    };

    validate_passkey_site(&site)?;
    Ok(site)
}

pub fn default_passkey_origin(host: &str, port: u16) -> String {
    let host = match host {
        "0.0.0.0" | "::" | "[::]" => "localhost".to_string(),
        value if value.contains(':') && !value.starts_with('[') => format!("[{}]", value),
        value => value.to_string(),
    };
    format!("http://{}:{}", host, port)
}

pub fn resolve_passkey_origin(host: &str, port: u16, configured_origin: Option<&str>) -> String {
    configured_origin
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| default_passkey_origin(host, port))
}

fn ensure_request_origin(req: &HttpRequest, site: &PasskeySiteConfig) -> AppResult<()> {
    let connection = req.connection_info();
    let actual_origin = Url::parse(&format!("{}://{}", connection.scheme(), connection.host()))
        .map_err(|_| {
            AppError::BadRequest(
                "当前访问地址与 Passkey 配置不一致，请使用配置中的访问地址登录".to_string(),
            )
        })?;
    let expected_origin = Url::parse(&site.origin).map_err(|_| {
        AppError::BadRequest("Passkey 访问地址配置无效，请检查服务启动地址".to_string())
    })?;

    if actual_origin.scheme() != expected_origin.scheme()
        || actual_origin.host_str() != expected_origin.host_str()
        || actual_origin.port_or_known_default() != expected_origin.port_or_known_default()
    {
        return Err(AppError::BadRequest(format!(
            "当前访问地址与 Passkey 配置不一致，请使用 {} 访问",
            site.origin
        )));
    }

    Ok(())
}

fn build_webauthn(site: &PasskeySiteConfig, timeout_seconds: u64) -> AppResult<Webauthn> {
    build_webauthn_with_message(
        site,
        timeout_seconds,
        "当前访问地址不支持 Passkey，请使用 localhost 或受信任域名访问",
    )
}

fn validate_passkey_site(site: &PasskeySiteConfig) -> AppResult<()> {
    build_webauthn_with_message(
        site,
        DEFAULT_CEREMONY_TIMEOUT_SECONDS,
        "Passkey 访问地址配置无效，请使用 localhost 或受信任域名访问",
    )
    .map(|_| ())
}

fn build_webauthn_with_message(
    site: &PasskeySiteConfig,
    timeout_seconds: u64,
    error_message: &str,
) -> AppResult<Webauthn> {
    let origin = Url::parse(&site.origin)
        .map_err(|_| AppError::BadRequest("Passkey 配置无效，请检查访问地址".to_string()))?;

    WebauthnBuilder::new(&site.rp_id, &origin)
        .map(|builder| {
            builder
                .rp_name(PASSKEY_RP_NAME)
                .timeout(Duration::from_secs(timeout_seconds))
        })
        .and_then(WebauthnBuilder::build)
        .map_err(|err| {
            log::warn!("build webauthn failed: {}", err);
            AppError::BadRequest(error_message.to_string())
        })
}

fn cleanup_challenges<T>(
    entries: &Arc<Mutex<HashMap<String, ChallengeRecord<T>>>>,
    timeout_seconds: u64,
) -> AppResult<()> {
    let deadline = Utc::now() - chrono::Duration::seconds(timeout_seconds as i64);
    entries
        .lock()
        .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?
        .retain(|_, value| value.started_at >= deadline);
    Ok(())
}

fn build_auth_binding(auth: &AuthState) -> String {
    let mut hasher = Sha256::new();
    hasher.update(auth.config.username.as_bytes());
    hasher.update([0_u8]);
    hasher.update(auth.config.password.as_bytes());
    hasher.update([0_u8]);
    hasher.update(auth.config.algorithm.to_string().as_bytes());
    hasher.update([0_u8]);
    let source = match auth.config.source {
        PasswordSource::Hashed => b"hashed".as_slice(),
        PasswordSource::Plain => b"plain".as_slice(),
    };
    hasher.update(source);
    format!("{:x}", hasher.finalize())
}

fn save_store_to_path(path: &PathBuf, store: &PasskeyStoreData) -> AppResult<()> {
    let content = serde_json::to_vec_pretty(store)?;
    let tmp_path = path.with_extension("json.tmp");
    let mut options = fs::OpenOptions::new();
    options.create(true).write(true).truncate(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut file = options.open(&tmp_path)?;
    file.write_all(&content)?;
    file.sync_all()?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

fn take_challenge<T: Clone>(
    entries: &Arc<Mutex<HashMap<String, ChallengeRecord<T>>>>,
    request_id: &str,
    timeout_seconds: u64,
    expired_message: &str,
) -> AppResult<ChallengeRecord<T>> {
    cleanup_challenges(entries, timeout_seconds)?;

    let challenge = entries
        .lock()
        .map_err(|_| AppError::InternalError("Passkey 状态已损坏".to_string()))?
        .remove(request_id)
        .ok_or_else(|| AppError::BadRequest(expired_message.to_string()))?;

    if (Utc::now() - challenge.started_at).num_seconds() > timeout_seconds as i64 {
        return Err(AppError::BadRequest(expired_message.to_string()));
    }

    Ok(challenge)
}

#[cfg(test)]
mod tests {
    use super::{
        build_auth_binding, build_passkey_site, default_passkey_origin, ensure_request_origin,
        load_store, normalize_passkey_name, resolve_passkey_origin, save_store_to_path,
        PasskeyStoreData, MAX_PENDING_CHALLENGES,
    };
    use actix_web::{http::header, test::TestRequest};
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    use crate::auth::{AuthConfig, AuthState, PasswordSource};
    use crate::config::PasswordAlgorithm;

    #[test]
    fn default_passkey_origin_maps_wildcard_hosts_to_localhost() {
        assert_eq!(
            default_passkey_origin("0.0.0.0", 4567),
            "http://localhost:4567"
        );
        assert_eq!(default_passkey_origin("::", 4567), "http://localhost:4567");
    }

    #[test]
    fn default_passkey_origin_wraps_ipv6_addresses() {
        assert_eq!(default_passkey_origin("::1", 4567), "http://[::1]:4567");
    }

    #[test]
    fn resolve_passkey_origin_prefers_configured_value() {
        assert_eq!(
            resolve_passkey_origin("0.0.0.0", 4567, Some("https://example.com")),
            "https://example.com"
        );
    }

    #[test]
    fn resolve_passkey_origin_ignores_blank_configured_value() {
        assert_eq!(
            resolve_passkey_origin("0.0.0.0", 4567, Some("   ")),
            "http://localhost:4567"
        );
    }

    #[test]
    fn build_passkey_site_rejects_non_origin_url() {
        assert!(build_passkey_site("https://example.com/app").is_err());
        assert!(build_passkey_site("https://user@example.com").is_err());
        assert!(build_passkey_site("ftp://example.com").is_err());
    }

    #[test]
    fn build_passkey_site_accepts_plain_origin() {
        assert!(build_passkey_site("https://example.com:8443").is_ok());
    }

    #[test]
    fn ensure_request_origin_accepts_exact_match() {
        let site = build_passkey_site("https://example.com:8443").unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com:8443"))
            .insert_header(("X-Forwarded-Proto", "https"))
            .to_http_request();

        assert!(ensure_request_origin(&req, &site).is_ok());
    }

    #[test]
    fn ensure_request_origin_rejects_mismatched_host() {
        let site = build_passkey_site("https://example.com").unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "evil.example.com"))
            .insert_header(("X-Forwarded-Proto", "https"))
            .to_http_request();

        assert!(ensure_request_origin(&req, &site).is_err());
    }

    #[test]
    fn ensure_request_origin_rejects_mismatched_scheme() {
        let site = build_passkey_site("https://example.com").unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .to_http_request();

        assert!(ensure_request_origin(&req, &site).is_err());
    }

    #[test]
    fn ensure_request_origin_normalizes_default_https_port() {
        let site = build_passkey_site("https://example.com").unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com:443"))
            .insert_header(("X-Forwarded-Proto", "https"))
            .to_http_request();

        assert!(ensure_request_origin(&req, &site).is_ok());
    }

    #[test]
    fn ensure_request_origin_uses_forwarded_headers() {
        let site = build_passkey_site("https://example.com").unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "127.0.0.1:4567"))
            .insert_header(("X-Forwarded-Host", "example.com"))
            .insert_header(("X-Forwarded-Proto", "https"))
            .to_http_request();

        assert!(ensure_request_origin(&req, &site).is_ok());
    }

    fn make_test_auth(username: &str, password: &str) -> AuthState {
        AuthState {
            config: AuthConfig {
                username: username.to_string(),
                password: password.to_string(),
                algorithm: PasswordAlgorithm::Argon2,
                source: PasswordSource::Plain,
            },
            sessions: Arc::new(Mutex::new(HashMap::new())),
            session_timeout_minutes: Arc::new(Mutex::new(60)),
            secret_key: Arc::new(vec![0; 32]),
            secure_cookies: false,
        }
    }

    #[test]
    fn auth_binding_changes_when_username_changes() {
        let auth1 = make_test_auth("admin", "secret");
        let auth2 = make_test_auth("root", "secret");
        assert_ne!(build_auth_binding(&auth1), build_auth_binding(&auth2));
    }

    #[test]
    fn auth_binding_changes_when_password_changes() {
        let auth1 = make_test_auth("admin", "secret1");
        let auth2 = make_test_auth("admin", "secret2");
        assert_ne!(build_auth_binding(&auth1), build_auth_binding(&auth2));
    }

    #[test]
    fn auth_binding_is_deterministic() {
        let auth = make_test_auth("admin", "secret");
        assert_eq!(build_auth_binding(&auth), build_auth_binding(&auth));
    }

    #[test]
    fn load_store_returns_empty_for_missing_file() {
        let path = std::path::PathBuf::from("/tmp/openmkview-test-nonexistent.json");
        let store = load_store(&path).unwrap();
        assert!(store.credentials.is_empty());
        assert!(!store.user_id.is_empty());
    }

    #[test]
    fn load_store_recovers_from_broken_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("passkeys.json");
        std::fs::write(&path, "not valid json!!!").unwrap();

        let store = load_store(&path).unwrap();
        assert!(store.credentials.is_empty());
        // Original file should be renamed
        assert!(!path.exists());
        // Broken backup should exist
        let entries: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].file_name().to_str().unwrap().contains("broken-"));
    }

    #[test]
    fn save_and_load_store_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("passkeys.json");
        let store = PasskeyStoreData {
            auth_binding: "test-binding".to_string(),
            user_id: "test-user-id".to_string(),
            credentials: Vec::new(),
        };
        save_store_to_path(&path, &store).unwrap();
        let loaded = load_store(&path).unwrap();
        assert_eq!(loaded.user_id, "test-user-id");
        assert_eq!(loaded.auth_binding, "test-binding");
        assert!(loaded.credentials.is_empty());
    }

    #[test]
    fn normalize_passkey_name_defaults_to_this_device() {
        assert_eq!(normalize_passkey_name(None), "This device");
        assert_eq!(normalize_passkey_name(Some("".to_string())), "This device");
        assert_eq!(
            normalize_passkey_name(Some("   ".to_string())),
            "This device"
        );
    }

    #[test]
    fn normalize_passkey_name_truncates_long_names() {
        let long_name = "a".repeat(200);
        let result = normalize_passkey_name(Some(long_name));
        assert_eq!(result.len(), 80);
    }

    #[test]
    fn normalize_passkey_name_preserves_valid_names() {
        assert_eq!(
            normalize_passkey_name(Some("My MacBook".to_string())),
            "My MacBook"
        );
    }

    #[test]
    fn max_pending_challenges_is_reasonable() {
        let limit = MAX_PENDING_CHALLENGES;
        assert!(limit >= 10);
        assert!(limit <= 1000);
    }
}
