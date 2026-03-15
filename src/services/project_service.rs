use crate::db::ProjectRepository;
use crate::errors::{AppError, AppResult};
use crate::models::{CreateProjectRequest, Project};
use std::path::PathBuf;

pub struct ProjectService<'a> {
    project_repo: ProjectRepository<'a>,
}

impl<'a> ProjectService<'a> {
    pub fn new(project_repo: ProjectRepository<'a>) -> Self {
        Self { project_repo }
    }

    pub fn list_projects(&self, open_only: bool) -> AppResult<Vec<Project>> {
        self.project_repo.list(open_only)
    }

    pub fn create_or_open_project(&self, req: &CreateProjectRequest) -> AppResult<Project> {
        let resolved_path = PathBuf::from(&req.path)
            .canonicalize()
            .map_err(|_| AppError::BadRequest("目录不存在".into()))?;

        if !resolved_path.is_dir() {
            return Err(AppError::BadRequest("路径不是目录".into()));
        }

        let path_str = resolved_path.to_str().unwrap().to_string();
        let name = resolved_path
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        if let Some(existing) = self.project_repo.find_by_path(&path_str)? {
            self.project_repo.update_open_status(existing.id, true)?;
            return self
                .project_repo
                .find_by_id(existing.id)
                .and_then(|p| p.ok_or_else(|| AppError::NotFound("项目未找到".into())));
        }

        self.project_repo.create(&path_str, &name)
    }

    pub fn close_project(&self, id: i64) -> AppResult<bool> {
        self.project_repo.update_open_status(id, false)
    }

    pub fn get_project_path(&self, id: i64) -> AppResult<PathBuf> {
        let path = self.project_repo.get_path(id)?;
        Ok(PathBuf::from(path))
    }
}
