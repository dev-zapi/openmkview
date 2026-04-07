use crate::db::ProjectRepository;
use crate::errors::{AppError, AppResult};
use crate::models::{CreateProjectRequest, Project};
use log::debug;
use std::path::PathBuf;

pub struct ProjectService<'a> {
    project_repo: ProjectRepository<'a>,
}

impl<'a> ProjectService<'a> {
    pub fn new(project_repo: ProjectRepository<'a>) -> Self {
        Self { project_repo }
    }

    pub fn list_projects(&self, open_only: bool) -> AppResult<Vec<Project>> {
        debug!("[ProjectService] Listing projects, open_only={}", open_only);
        self.project_repo.list(open_only)
    }

    pub fn create_or_open_project(&self, req: &CreateProjectRequest) -> AppResult<Project> {
        debug!(
            "[ProjectService] Creating or opening project: path={}",
            req.path
        );

        let path = PathBuf::from(&req.path);
        let resolved_path = match path.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                let absolute_path = if path.is_absolute() {
                    path
                } else {
                    std::env::current_dir()
                        .map_err(|e| AppError::InternalError(format!("无法获取当前目录: {}", e)))?
                        .join(&path)
                };

                if !absolute_path.exists() {
                    return Err(AppError::BadRequest(format!(
                        "目录不存在: {}",
                        absolute_path.display()
                    )));
                }

                absolute_path.canonicalize().map_err(|e| {
                    debug!("[ProjectService] Failed to canonicalize path: {}", e);
                    AppError::BadRequest("无法解析目录路径".into())
                })?
            }
        };

        debug!("[ProjectService] Resolved path: {:?}", resolved_path);

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
        debug!(
            "[ProjectService] Project name: {}, path: {}",
            name, path_str
        );

        if let Some(existing) = self.project_repo.find_by_path(&path_str)? {
            debug!(
                "[ProjectService] Project already exists, updating open status: id={}",
                existing.id
            );
            self.project_repo.update_open_status(existing.id, true)?;
            return self
                .project_repo
                .find_by_id(existing.id)
                .and_then(|p| p.ok_or_else(|| AppError::NotFound("Project not found".into())));
        }

        debug!("[ProjectService] Creating new project");
        self.project_repo.create(&path_str, &name)
    }

    pub fn close_project(&self, id: i64) -> AppResult<bool> {
        debug!("[ProjectService] Closing project: id={}", id);
        self.project_repo.update_open_status(id, false)
    }

    pub fn get_project_path(&self, id: i64) -> AppResult<PathBuf> {
        debug!("[ProjectService] Getting project path: id={}", id);
        let path = self.project_repo.get_path(id)?;
        debug!("[ProjectService] Project path: {:?}", path);
        Ok(PathBuf::from(path))
    }

    pub fn get_recent_projects(&self, limit: i64) -> AppResult<Vec<Project>> {
        debug!("[ProjectService] Getting recent projects, limit={}", limit);
        self.project_repo.get_recent_projects(limit)
    }

    pub fn validate_project_path(&self, path: &str) -> AppResult<(bool, Option<String>)> {
        debug!("[ProjectService] Validating project path: {}", path);
        let path_buf = PathBuf::from(path);

        if !path_buf.exists() {
            debug!("[ProjectService] Path does not exist: {}", path);
            return Ok((false, Some("目录不存在".to_string())));
        }

        if !path_buf.is_dir() {
            debug!("[ProjectService] Path is not a directory: {}", path);
            return Ok((false, Some("路径不是目录".to_string())));
        }

        let has_markdown = self.check_markdown_files(&path_buf)?;
        if !has_markdown {
            debug!(
                "[ProjectService] No Markdown files found in directory: {}",
                path
            );
            return Ok((
                false,
                Some("目录中没有找到 Markdown 文件（.md 或 .mdx）".to_string()),
            ));
        }

        debug!("[ProjectService] Path validation passed: {}", path);
        Ok((true, None))
    }

    pub fn update_project_color(&self, id: i64, color: &str) -> AppResult<bool> {
        debug!(
            "[ProjectService] Updating project color: id={}, color={}",
            id, color
        );
        self.project_repo.update_color(id, color)
    }

    pub fn update_project(
        &self,
        id: i64,
        name: Option<&str>,
        color: Option<&str>,
        icon: Option<&str>,
    ) -> AppResult<bool> {
        debug!(
            "[ProjectService] Updating project info: id={}, name={:?}, color={:?}, icon={:?}",
            id, name, color, icon
        );
        self.project_repo.update_project(id, name, color, icon)
    }

    fn check_markdown_files(&self, dir: &PathBuf) -> AppResult<bool> {
        let entries = std::fs::read_dir(dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext = ext.to_string_lossy().to_lowercase();
                    if ext == "md" || ext == "mdx" {
                        return Ok(true);
                    }
                }
            } else if path.is_dir() {
                if self.check_markdown_files(&path)? {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }
}
