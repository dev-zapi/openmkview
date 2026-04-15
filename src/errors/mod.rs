use actix_web::{HttpResponse, ResponseError};
use serde::Serialize;
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    DatabaseError(String),
    NotFound(String),
    BadRequest(String),
    InternalError(String),
    FileError(String),
    GitError(String),
    ValidationError(String),
    Conflict(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::BadRequest(msg) => write!(f, "{}", msg),
            AppError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            AppError::FileError(msg) => write!(f, "File error: {}", msg),
            AppError::GitError(msg) => write!(f, "Git error: {}", msg),
            AppError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let error_msg = self.to_string();
        let error_response = ErrorResponse { error: error_msg };

        match self {
            AppError::NotFound(_) => HttpResponse::NotFound().json(error_response),
            AppError::BadRequest(_) => HttpResponse::BadRequest().json(error_response),
            AppError::ValidationError(_) => HttpResponse::BadRequest().json(error_response),
            AppError::Conflict(_) => HttpResponse::Conflict().json(error_response),
            AppError::FileError(_) => HttpResponse::InternalServerError().json(error_response),
            AppError::GitError(_) => HttpResponse::InternalServerError().json(error_response),
            AppError::DatabaseError(_) => HttpResponse::InternalServerError().json(error_response),
            AppError::InternalError(_) => HttpResponse::InternalServerError().json(error_response),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::FileError(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::InternalError(err.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
