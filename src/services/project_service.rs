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
        debug!("[ProjectService] 列出项目, open_only={}", open_only);
        self.project_repo.list(open_only)
    }

    pub fn create_or_open_project(&self, req: &CreateProjectRequest) -> AppResult<Project> {
        debug!("[ProjectService] 创建或打开项目: path={}", req.path);
        let resolved_path = PathBuf::from(&req.path)
            .canonicalize()
            .map_err(|_| AppError::BadRequest("目录不存在".into()))?;
        debug!("[ProjectService] 解析后路径: {:?}", resolved_path);

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
        debug!("[ProjectService] 项目名称: {}, 路径: {}", name, path_str);

        if let Some(existing) = self.project_repo.find_by_path(&path_str)? {
            debug!(
                "[ProjectService] 项目已存在, 更新打开状态: id={}",
                existing.id
            );
            self.project_repo.update_open_status(existing.id, true)?;
            return self
                .project_repo
                .find_by_id(existing.id)
                .and_then(|p| p.ok_or_else(|| AppError::NotFound("项目未找到".into())));
        }

        debug!("[ProjectService] 创建新项目");
        self.project_repo.create(&path_str, &name)
    }

    pub fn close_project(&self, id: i64) -> AppResult<bool> {
        debug!("[ProjectService] 关闭项目: id={}", id);
        self.project_repo.update_open_status(id, false)
    }

    pub fn get_project_path(&self, id: i64) -> AppResult<PathBuf> {
        debug!("[ProjectService] 获取项目路径: id={}", id);
        let path = self.project_repo.get_path(id)?;
        debug!("[ProjectService] 项目路径: {:?}", path);
        Ok(PathBuf::from(path))
    }

    pub fn get_recent_projects(&self, limit: i64) -> AppResult<Vec<Project>> {
        debug!("[ProjectService] 获取最近项目, limit={}", limit);
        self.project_repo.get_recent_projects(limit)
    }

    pub fn validate_project_path(&self, path: &str) -> AppResult<(bool, Option<String>)> {
        debug!("[ProjectService] 验证项目路径: {}", path);
        let path_buf = PathBuf::from(path);

        if !path_buf.exists() {
            debug!("[ProjectService] 路径不存在: {}", path);
            return Ok((false, Some("路径不存在".to_string())));
        }

        if !path_buf.is_dir() {
            debug!("[ProjectService] 路径不是目录: {}", path);
            return Ok((false, Some("路径不是目录".to_string())));
        }

        let has_markdown = self.check_markdown_files(&path_buf)?;
        if !has_markdown {
            debug!("[ProjectService] 目录中未找到 Markdown 文件: {}", path);
            return Ok((
                false,
                Some("目录中未找到 Markdown 文件(.md 或 .mdx)".to_string()),
            ));
        }

        debug!("[ProjectService] 路径验证通过: {}", path);
        Ok((true, None))
    }

    pub fn update_project_color(&self, id: i64, color: &str) -> AppResult<bool> {
        debug!("[ProjectService] 更新项目颜色: id={}, color={}", id, color);
        self.project_repo.update_color(id, color)
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
