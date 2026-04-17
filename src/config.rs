use crate::errors::{AppError, AppResult};
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use bcrypt::{hash as bcrypt_hash, verify as bcrypt_verify, DEFAULT_COST};
use clap::ValueEnum;
use dirs::config_dir;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const DEFAULT_SESSION_TIMEOUT_MINUTES: u64 = 60;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ValueEnum, Default)]
#[serde(rename_all = "lowercase")]
pub enum PasswordAlgorithm {
    #[default]
    Argon2,
    Bcrypt,
}

impl std::fmt::Display for PasswordAlgorithm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Argon2 => write!(f, "argon2"),
            Self::Bcrypt => write!(f, "bcrypt"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub auth: AuthFileConfig,
    #[serde(default)]
    pub session: SessionFileConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuthFileConfig {
    pub username: Option<String>,
    pub password_hash: Option<String>,
    #[serde(default)]
    pub algorithm: PasswordAlgorithm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFileConfig {
    #[serde(default = "default_session_timeout_minutes")]
    pub timeout_minutes: u64,
    pub secret_key: Option<String>,
}

impl Default for SessionFileConfig {
    fn default() -> Self {
        Self {
            timeout_minutes: default_session_timeout_minutes(),
            secret_key: None,
        }
    }
}

fn default_session_timeout_minutes() -> u64 {
    DEFAULT_SESSION_TIMEOUT_MINUTES
}

pub fn default_timeout_minutes() -> u64 {
    DEFAULT_SESSION_TIMEOUT_MINUTES
}

pub fn config_file_path() -> AppResult<PathBuf> {
    let base =
        config_dir().ok_or_else(|| AppError::InternalError("无法获取配置目录".to_string()))?;
    Ok(base.join("openmkview").join("config.toml"))
}

pub fn load_config() -> AppResult<AppConfig> {
    let path = config_file_path()?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(path)?;
    let config = toml::from_str::<AppConfig>(&content)
        .map_err(|err| AppError::BadRequest(format!("配置文件格式无效: {}", err)))?;
    Ok(config)
}

pub fn save_config(config: &AppConfig) -> AppResult<()> {
    let path = config_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = toml::to_string_pretty(config)
        .map_err(|err| AppError::InternalError(format!("配置文件序列化失败: {}", err)))?;
    fs::write(path, content)?;
    Ok(())
}

pub fn ensure_secret_key(config: &mut AppConfig) -> AppResult<Vec<u8>> {
    if let Some(secret_key) = &config.session.secret_key {
        let decoded = STANDARD
            .decode(secret_key)
            .map_err(|_| AppError::BadRequest("配置文件中的 session secret 无效".to_string()))?;
        if decoded.len() < 32 {
            return Err(AppError::BadRequest(
                "配置文件中的 session secret 长度不足".to_string(),
            ));
        }
        return Ok(decoded);
    }

    let mut secret = vec![0_u8; 32];
    rand::thread_rng().fill_bytes(&mut secret);
    config.session.secret_key = Some(STANDARD.encode(&secret));
    save_config(config)?;
    Ok(secret)
}

pub fn hash_password(password: &str, algorithm: PasswordAlgorithm) -> AppResult<String> {
    if password.is_empty() {
        return Err(AppError::BadRequest("密码不能为空".to_string()));
    }

    match algorithm {
        PasswordAlgorithm::Argon2 => {
            let salt = SaltString::generate(&mut OsRng);
            Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|err| AppError::InternalError(format!("密码加密失败: {}", err)))
        }
        PasswordAlgorithm::Bcrypt => bcrypt_hash(password, DEFAULT_COST)
            .map_err(|err| AppError::InternalError(format!("密码加密失败: {}", err))),
    }
}

pub fn verify_password(
    password: &str,
    expected: &str,
    algorithm: PasswordAlgorithm,
) -> AppResult<bool> {
    match algorithm {
        PasswordAlgorithm::Argon2 => {
            let parsed_hash = PasswordHash::new(expected)
                .map_err(|err| AppError::BadRequest(format!("密码哈希无效: {}", err)))?;
            Ok(Argon2::default()
                .verify_password(password.as_bytes(), &parsed_hash)
                .is_ok())
        }
        PasswordAlgorithm::Bcrypt => bcrypt_verify(password, expected)
            .map_err(|err| AppError::BadRequest(format!("密码哈希无效: {}", err))),
    }
}
