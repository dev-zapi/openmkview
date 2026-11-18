use crate::db::{AnnotationRepository, ProjectRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{Annotation, CreateAnnotationRequest};
use crate::services::FileService;
use rusqlite::Connection;

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
