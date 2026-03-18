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

    /// 获取最近打开的项目列表
    pub fn get_recent_projects(&self, limit: i64) -> AppResult<Vec<Project>> {
        self.project_repo.get_recent_projects(limit)
    }

    /// 验证项目路径是否有效
    pub fn validate_project_path(&self, path: &str,
    ) -> AppResult<( bool, Option<String>) > {
        let path_buf = PathBuf::from(path);

        // 检查路径是否存在
        if !path_buf.exists() {
            return Ok((false, Some("路径不存在".to_string())));
        }

        // 检查是否为目录
        if !path_buf.is_dir() {
            return Ok((false, Some("路径不是目录".to_string())));
        }

        // 检查是否包含 Markdown 文件
        let has_markdown = self.check_markdown_files(&path_buf)?;
        if !has_markdown {
            return Ok((false, Some("目录中未找到 Markdown 文件(.md 或 .mdx)".to_string())));
        }

        Ok((true, None))
    }

    /// 递归检查目录中是否包含 Markdown 文件
    fn check_markdown_files(&self, dir: &PathBuf,
    ) -> AppResult<bool> {
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
                // 递归检查子目录
                if self.check_markdown_files(&path)? {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }
}
