use crate::db::{AnnotationRepository, ProjectRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{Annotation, CreateAnnotationRequest};
use crate::services::FileService;
use rusqlite::Connection;
use serde_json::Value;

fn bad_anchor(message: &str) -> AppError {
    AppError::BadRequest(message.into())
}

fn validate_segment_common(segment: &serde_json::Map<String, Value>) -> AppResult<()> {
    let block_hash = segment
        .get("blockHash")
        .and_then(Value::as_str)
        .ok_or_else(|| bad_anchor("Anchor segment requires a blockHash"))?;
    if block_hash.is_empty() {
        return Err(bad_anchor("Anchor segment blockHash cannot be empty"));
    }

    if segment.get("blockText").and_then(Value::as_str).is_none() {
        return Err(bad_anchor("Anchor segment requires blockText"));
    }
    if segment.get("blockType").and_then(Value::as_str).is_none() {
        return Err(bad_anchor("Anchor segment requires blockType"));
    }

    let heading_path = segment
        .get("headingPath")
        .and_then(Value::as_array)
        .ok_or_else(|| bad_anchor("Anchor segment requires a headingPath array"))?;
    if heading_path.iter().any(|part| !part.is_string()) {
        return Err(bad_anchor(
            "Anchor segment headingPath must contain strings",
        ));
    }

    Ok(())
}

fn validate_anchor(anchor: &Value) -> AppResult<()> {
    let object = anchor
        .as_object()
        .ok_or_else(|| bad_anchor("Anchor must be a JSON object"))?;

    object
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| bad_anchor("Anchor requires a numeric version"))?;

    let segments = object
        .get("segments")
        .and_then(Value::as_array)
        .filter(|segments| !segments.is_empty())
        .ok_or_else(|| bad_anchor("Anchor requires at least one segment"))?;

    for segment in segments {
        let segment = segment
            .as_object()
            .ok_or_else(|| bad_anchor("Anchor segment must be an object"))?;
        validate_segment_common(segment)?;

        match segment.get("kind").and_then(Value::as_str) {
            Some("block") => {}
            Some("text") => {
                let quote = segment
                    .get("quote")
                    .and_then(Value::as_str)
                    .ok_or_else(|| bad_anchor("Text segment requires a quote"))?;
                if quote.trim().is_empty() {
                    return Err(bad_anchor("Text segment quote cannot be empty"));
                }
                if segment.get("prefix").and_then(Value::as_str).is_none() {
                    return Err(bad_anchor("Text segment requires a prefix"));
                }
                if segment.get("suffix").and_then(Value::as_str).is_none() {
                    return Err(bad_anchor("Text segment requires a suffix"));
                }
            }
            _ => return Err(bad_anchor("Anchor segment kind must be block or text")),
        }
    }

    Ok(())
}

pub struct AnnotationService<'a> {
    annotation_repo: AnnotationRepository<'a>,
    project_repo: ProjectRepository<'a>,
}

impl<'a> AnnotationService<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self {
            annotation_repo: AnnotationRepository::new(conn),
            project_repo: ProjectRepository::new(conn),
        }
    }

    pub fn list_for_file(
        &self,
        project_id: i64,
        relative_path: &str,
    ) -> AppResult<Vec<Annotation>> {
        self.require_project(project_id)?;
        FileService::validate_relative_path(relative_path)?;
        self.annotation_repo
            .list_for_file(project_id, relative_path)
    }

    pub fn create(&self, req: CreateAnnotationRequest) -> AppResult<Annotation> {
        self.require_project(req.project_id)?;
        FileService::validate_relative_path(&req.relative_path)?;

        let body = req.body.trim();
        if body.is_empty() {
            return Err(AppError::BadRequest("Note body is required".into()));
        }

        if !req.anchor.is_object() {
            return Err(AppError::BadRequest("Anchor must be a JSON object".into()));
        }
        validate_anchor(&req.anchor)?;

        let anchor_json = serde_json::to_string(&req.anchor)?;
        self.annotation_repo
            .create(req.project_id, &req.relative_path, &anchor_json, None, body)
    }

    pub fn delete(&self, id: i64) -> AppResult<()> {
        match self.annotation_repo.delete(id)? {
            true => Ok(()),
            false => Err(AppError::NotFound("Annotation not found".into())),
        }
    }

    fn require_project(&self, project_id: i64) -> AppResult<()> {
        if self.project_repo.find_by_id(project_id)?.is_none() {
            return Err(AppError::NotFound("Project not found".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "annotation_service_test.rs"]
mod annotation_service_test;
