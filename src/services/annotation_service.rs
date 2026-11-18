use crate::db::{AnnotationRepository, ProjectRepository};
use crate::errors::{AppError, AppResult};
use crate::models::{Annotation, CreateAnnotationRequest, Project};
use crate::services::FileService;
use rusqlite::Connection;
use std::path::Path;

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

    fn require_project(&self, project_id: i64) -> AppResult<Project> {
        self.project_repo
            .find_by_id(project_id)?
            .ok_or_else(|| AppError::NotFound("Project not found".into()))
    }
}

#[cfg(test)]
#[path = "annotation_service_test.rs"]
mod annotation_service_test;
