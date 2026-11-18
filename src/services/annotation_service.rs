use crate::db::{AnnotationRepository, ProjectRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{Annotation, CreateAnnotationRequest, Project};
use crate::services::FileService;
use rusqlite::Connection;
use serde_json::Value;
use std::path::Path;

fn bad_anchor(message: &str) -> AppError {
    AppError::BadRequest(message.into())
}

/// The text an Outdated annotation shows as its snapshot: the originally
/// anchored quote (text segments) or block text (whole-block segments),
/// joined in document order. Derived from the Anchor payload so it is always
/// available, including for annotations created before snapshots were stored.
fn snapshot_from_anchor(anchor: &Value) -> Option<String> {
    let segments = anchor.get("segments")?.as_array()?;
    let parts: Vec<&str> = segments
        .iter()
        .filter_map(|segment| {
            segment
                .get("quote")
                .and_then(Value::as_str)
                .or_else(|| segment.get("blockText").and_then(Value::as_str))
        })
        .filter(|text| !text.trim().is_empty())
        .collect();

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n\n"))
    }
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
        let project = self.require_project(project_id)?;
        FileService::validate_relative_path(relative_path)?;

        // Documents only surface annotations for files that currently exist at
        // the stored path. Trashed files and files renamed outside the app are
        // hidden here while their rows stay in the database (ADR-0006).
        if !Path::new(&project.path).join(relative_path).is_file() {
            return Ok(Vec::new());
        }

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
        let snapshot = snapshot_from_anchor(&req.anchor);
        self.annotation_repo.create(
            req.project_id,
            &req.relative_path,
            &anchor_json,
            snapshot.as_deref(),
            body,
        )
    }

    /// Manually re-anchor an Outdated annotation to a freshly selected range.
    ///
    /// The new Anchor payload replaces the old one and the snapshot is
    /// refreshed from it, so the stale Outdated text no longer surfaces. The
    /// note thread and Resolved flag are untouched.
    pub fn reanchor(&self, id: i64, anchor: Value) -> AppResult<Annotation> {
        if !anchor.is_object() {
            return Err(AppError::BadRequest("Anchor must be a JSON object".into()));
        }
        validate_anchor(&anchor)?;

        let anchor_json = serde_json::to_string(&anchor)?;
        let snapshot = snapshot_from_anchor(&anchor);
        self.annotation_repo
            .update_anchor(id, &anchor_json, snapshot.as_deref())?
            .ok_or_else(|| AppError::NotFound("Annotation not found".into()))
    }

    pub fn delete(&self, id: i64) -> AppResult<()> {
        match self.annotation_repo.delete(id)? {
            true => Ok(()),
            false => Err(AppError::NotFound("Annotation not found".into())),
        }
    }

    /// Follow a file or directory that was renamed/moved inside the app.
    ///
    /// The filesystem stays the source of truth: only annotation rows are
    /// rewritten, and nothing is ever written into the project directory.
    pub fn migrate_paths(&self, project_id: i64, from: &str, to: &str) -> AppResult<usize> {
        self.require_project(project_id)?;
        FileService::validate_relative_path(from)?;
        FileService::validate_relative_path(to)?;
        self.annotation_repo.move_paths(project_id, from, to)
    }

    pub fn append_note(&self, annotation_id: i64, body: &str) -> AppResult<Annotation> {
        let body = body.trim();
        if body.is_empty() {
            return Err(AppError::BadRequest("Note body is required".into()));
        }

        self.annotation_repo
            .append_note(annotation_id, body)?
            .ok_or_else(|| AppError::NotFound("Annotation not found".into()))
    }

    pub fn update_note(
        &self,
        annotation_id: i64,
        note_id: i64,
        body: &str,
    ) -> AppResult<Annotation> {
        let body = body.trim();
        if body.is_empty() {
            return Err(AppError::BadRequest("Note body is required".into()));
        }

        if self.annotation_repo.find_by_id(annotation_id)?.is_none() {
            return Err(AppError::NotFound("Annotation not found".into()));
        }

        if !self
            .annotation_repo
            .update_note(annotation_id, note_id, body)?
        {
            return Err(AppError::NotFound("Note not found".into()));
        }

        self.annotation_repo
            .find_by_id(annotation_id)?
            .ok_or_else(|| AppError::NotFound("Annotation not found".into()))
    }

    pub fn set_resolved(&self, annotation_id: i64, resolved: bool) -> AppResult<Annotation> {
        if !self.annotation_repo.set_resolved(annotation_id, resolved)? {
            return Err(AppError::NotFound("Annotation not found".into()));
        }

        self.annotation_repo
            .find_by_id(annotation_id)?
            .ok_or_else(|| AppError::NotFound("Annotation not found".into()))
    }

    fn require_project(&self, project_id: i64) -> AppResult<Project> {
        self.project_repo
            .find_by_id(project_id)?
            .ok_or_else(|| AppError::NotFound("Project not found".into()))
    }
}

#[cfg(test)]
#[path = "annotation_service_test.rs"]
mod annotation_service_test;
