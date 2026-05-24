use crate::errors::{AppError, AppResult};
use crate::models::FileTreeNode;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub struct FileService;

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

const DOCUMENT_EXTENSIONS: &[&str] = &["md", "mdx", "html", "htm"];
const ALLOWED_IMAGE_EXTENSIONS: &[&str] =
    &["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];

impl FileService {
    pub fn is_document_file_type(ext: &str) -> bool {
        let ext_lower = ext.to_lowercase();
        DOCUMENT_EXTENSIONS.contains(&ext_lower.as_str())
    }

    pub fn is_allowed_file_type(ext: &str) -> bool {
        let ext_lower = ext.to_lowercase();
        ALLOWED_IMAGE_EXTENSIONS.contains(&ext_lower.as_str())
    }

    pub fn get_mime_type(ext: &str) -> &'static str {
        match ext.to_lowercase().as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            _ => "application/octet-stream",
        }
    }

    pub fn get_raw_file(
        project_path: &Path,
        relative_path: &str,
    ) -> AppResult<(Vec<u8>, String, String)> {
        // Validate relative path to prevent path traversal
        Self::validate_relative_path(relative_path)?;

        // Join relative path with project path
        let full_path = project_path.join(relative_path);

        let resolved = full_path
            .canonicalize()
            .map_err(|_| AppError::NotFound("File does not exist".into()))?;

        let project_resolved = project_path
            .canonicalize()
            .map_err(|_| AppError::FileError("Invalid project path".into()))?;

        if !resolved.starts_with(&project_resolved) {
            return Err(AppError::ValidationError("Access denied".into()));
        }

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        let ext_str = ext.as_deref().unwrap_or("");

        if !Self::is_allowed_file_type(ext_str) && !Self::is_document_file_type(ext_str) {
            return Err(AppError::BadRequest("File type not allowed".into()));
        }

        let metadata = std::fs::metadata(&resolved)?;
        if metadata.len() > MAX_FILE_SIZE {
            return Err(AppError::BadRequest("File too large (max 50MB)".into()));
        }

        let content = std::fs::read(&resolved)?;
        let mime_type = if Self::is_document_file_type(ext_str) {
            match ext_str {
                "html" | "htm" => "text/html",
                _ => "text/plain",
            }.to_string()
        } else {
            Self::get_mime_type(ext_str).to_string()
        };
        let file_name = resolved.file_name().unwrap().to_str().unwrap().to_string();

        Ok((content, mime_type, file_name))
    }

    /// Validate relative path to prevent path traversal attacks
    fn validate_relative_path(path: &str) -> AppResult<()> {
        if path.trim().is_empty() {
            return Err(AppError::ValidationError("Path is required".into()));
        }

        // Reject absolute paths
        if path.starts_with('/') || path.starts_with('\\') {
            return Err(AppError::ValidationError(
                "Absolute paths are not allowed".into(),
            ));
        }

        // Reject parent directory references
        if path.contains("..") {
            return Err(AppError::ValidationError(
                "Path traversal is not allowed".into(),
            ));
        }

        // Reject Windows drive letter paths
        if path.len() >= 2 && path.chars().nth(1) == Some(':') {
            return Err(AppError::ValidationError(
                "Absolute paths are not allowed".into(),
            ));
        }

        Ok(())
    }

    fn validate_file_name(file_name: &str) -> AppResult<()> {
        if file_name.trim().is_empty()
            || file_name.contains('/')
            || file_name.contains('\\')
            || file_name.contains("..")
            || file_name.len() >= 2 && file_name.chars().nth(1) == Some(':')
        {
            return Err(AppError::ValidationError("Invalid file name".into()));
        }

        Ok(())
    }

    fn canonical_project_path(project_path: &Path) -> AppResult<PathBuf> {
        project_path
            .canonicalize()
            .map_err(|_| AppError::FileError("Invalid project path".into()))
    }

    fn resolve_existing_project_path(
        project_path: &Path,
        relative_path: &str,
    ) -> AppResult<PathBuf> {
        Self::validate_relative_path(relative_path)?;

        let project_resolved = Self::canonical_project_path(project_path)?;
        let resolved = project_resolved
            .join(relative_path)
            .canonicalize()
            .map_err(|_| AppError::NotFound("File does not exist".into()))?;

        if !resolved.starts_with(&project_resolved) {
            return Err(AppError::ValidationError("Access denied".into()));
        }

        Ok(resolved)
    }

    fn resolve_new_project_path(project_path: &Path, relative_path: &str) -> AppResult<PathBuf> {
        Self::validate_relative_path(relative_path)?;

        let project_resolved = Self::canonical_project_path(project_path)?;
        let full_path = project_resolved.join(relative_path);
        let parent = full_path
            .parent()
            .ok_or_else(|| AppError::ValidationError("Invalid file path".into()))?;
        let parent_resolved = parent
            .canonicalize()
            .map_err(|_| AppError::NotFound("Parent directory does not exist".into()))?;

        if !parent_resolved.starts_with(&project_resolved) {
            return Err(AppError::ValidationError("Access denied".into()));
        }

        Ok(full_path)
    }

    pub fn build_tree(files: &[PathBuf], root_path: &Path) -> Vec<FileTreeNode> {
        fn build_node(
            files: &[&PathBuf],
            depth: usize,
            current_prefix: &str,
            _root_path: &Path,
        ) -> Vec<FileTreeNode> {
            let mut groups: BTreeMap<String, Vec<&PathBuf>> = BTreeMap::new();

            for file in files {
                let components: Vec<_> = file.components().collect();
                if components.len() > depth {
                    let name = components[depth].as_os_str().to_string_lossy().to_string();
                    groups.entry(name).or_default().push(file);
                }
            }

            let mut nodes = Vec::new();
            for (name, group_files) in groups {
                let is_file = group_files
                    .iter()
                    .any(|f| f.components().count() == depth + 1);

                if is_file {
                    for file in &group_files {
                        // Use relative path (file is already relative to root)
                        let relative_path = file.to_str().unwrap().to_string();
                        let file_type = file
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|e| e.to_lowercase());
                        let node_type = file_type.as_deref().and_then(|ext| {
                            if ext == "md" || ext == "mdx" {
                                Some("markdown".to_string())
                            } else if ext == "html" || ext == "htm" {
                                Some("html".to_string())
                            } else if FileService::is_allowed_file_type(ext) {
                                Some("image".to_string())
                            } else {
                                None
                            }
                        });

                        nodes.push(FileTreeNode {
                            id: relative_path.clone(),
                            name: name.clone(),
                            path: relative_path, // Return relative path
                            is_folder: false,
                            children: None,
                            file_type: node_type,
                        });
                    }
                } else {
                    let child_prefix = if current_prefix.is_empty() {
                        name.clone()
                    } else {
                        format!("{}/{}", current_prefix, name)
                    };
                    let children = build_node(&group_files, depth + 1, &child_prefix, _root_path);
                    nodes.push(FileTreeNode {
                        id: child_prefix.clone(),
                        name,
                        path: child_prefix, // Return relative path for folders too
                        is_folder: true,
                        children: Some(children),
                        file_type: None,
                    });
                }
            }
            nodes
        }

        let file_refs: Vec<&PathBuf> = files.iter().collect();
        let mut tree = build_node(&file_refs, 0, "", root_path);
        Self::sort_tree(&mut tree);
        tree
    }

    fn sort_tree(nodes: &mut [FileTreeNode]) {
        nodes.sort_by(|a, b| {
            if a.is_folder && !b.is_folder {
                std::cmp::Ordering::Less
            } else if !a.is_folder && b.is_folder {
                std::cmp::Ordering::Greater
            } else {
                a.name.cmp(&b.name)
            }
        });

        for node in nodes.iter_mut() {
            if let Some(children) = &mut node.children {
                Self::sort_tree(children);
            }
        }
    }

    pub fn get_file_content(
        project_path: &Path,
        relative_path: &str,
    ) -> AppResult<(String, String, String, u64, Option<std::time::SystemTime>)> {
        // Validate relative path to prevent path traversal
        Self::validate_relative_path(relative_path)?;

        // Join relative path with project path
        let full_path = project_path.join(relative_path);

        let resolved = full_path
            .canonicalize()
            .map_err(|_| AppError::NotFound("File does not exist".into()))?;

        let project_resolved = project_path
            .canonicalize()
            .map_err(|_| AppError::FileError("Invalid project path".into()))?;

        if !resolved.starts_with(&project_resolved) {
            return Err(AppError::ValidationError("Access denied".into()));
        }

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if !ext
            .as_deref()
            .is_some_and(FileService::is_document_file_type)
        {
            return Err(AppError::BadRequest(
                "Only Markdown and HTML files are supported".into(),
            ));
        }

        let content = std::fs::read_to_string(&resolved)?;
        let file_name = resolved.file_name().unwrap().to_str().unwrap().to_string();
        // Return relative path for frontend
        let path = relative_path;

        // Get file size and modification time
        let metadata = std::fs::metadata(&resolved)?;
        let file_size = metadata.len();
        let last_modified = metadata.modified().ok();

        Ok((
            content,
            file_name,
            path.to_string(),
            file_size,
            last_modified,
        ))
    }

    pub fn create_file(project_path: &Path, file_name: &str) -> AppResult<()> {
        let file_path = Self::resolve_new_project_path(project_path, file_name)?;

        if file_path.exists() {
            return Err(AppError::BadRequest("File already exists".into()));
        }

        std::fs::write(&file_path, "")?;
        Ok(())
    }

    pub fn rename_file(project_path: &Path, old_path: &str, new_name: &str) -> AppResult<()> {
        Self::validate_file_name(new_name)?;
        let old_path = Self::resolve_existing_project_path(project_path, old_path)?;
        let new_path = old_path
            .parent()
            .ok_or_else(|| AppError::ValidationError("Invalid file path".into()))?
            .join(new_name);

        if !old_path.exists() {
            return Err(AppError::NotFound("File does not exist".into()));
        }

        if new_path.exists() {
            return Err(AppError::BadRequest("Target file already exists".into()));
        }

        std::fs::rename(&old_path, &new_path)?;
        Ok(())
    }

    pub fn delete_file(project_path: &Path, file_path: &str) -> AppResult<()> {
        let file_path = Self::resolve_existing_project_path(project_path, file_path)?;

        if !file_path.is_file() {
            return Err(AppError::BadRequest("Only files can be deleted".into()));
        }

        std::fs::remove_file(&file_path)?;
        Ok(())
    }

    pub fn search_favicons(project_path: &Path) -> AppResult<Vec<String>> {
        let mut favicons = Vec::new();

        for entry in walkdir::WalkDir::new(project_path)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                name != "node_modules"
                    && name != ".git"
                    && name != "dist"
                    && name != "build"
                    && name != "target"
            })
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().unwrap().to_string_lossy();
                let name_lower = file_name.to_lowercase();
                if name_lower == "favicon.ico"
                    || name_lower == "favicon.png"
                    || name_lower == "favicon.svg"
                    || name_lower == "favicon.jpg"
                    || name_lower == "favicon.jpeg"
                    || name_lower == "favicon.webp"
                {
                    if let Ok(rel) = path.strip_prefix(project_path) {
                        favicons.push(rel.to_path_buf().to_string_lossy().to_string());
                    }
                }
            }
        }

        Ok(favicons)
    }

    pub fn save_file_content(
        project_path: &Path,
        relative_path: &str,
        content: &str,
        expected_modified_at: Option<&str>,
    ) -> AppResult<(u64, std::time::SystemTime)> {
        // Validate relative path to prevent path traversal
        Self::validate_relative_path(relative_path)?;

        // Join relative path with project path
        let full_path = project_path.join(relative_path);

        let resolved = full_path
            .canonicalize()
            .map_err(|_| AppError::NotFound("File does not exist".into()))?;

        let project_resolved = project_path
            .canonicalize()
            .map_err(|_| AppError::FileError("Invalid project path".into()))?;

        if !resolved.starts_with(&project_resolved) {
            return Err(AppError::ValidationError(
                "Access denied: path outside project".into(),
            ));
        }

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if !ext
            .as_deref()
            .is_some_and(FileService::is_document_file_type)
        {
            return Err(AppError::BadRequest(
                "Only Markdown and HTML files (.md/.mdx/.html/.htm) can be edited".into(),
            ));
        }

        // Optimistic concurrency check: verify file hasn't been modified externally
        if let Some(expected) = expected_modified_at {
            let current_metadata = std::fs::metadata(&resolved)?;
            let current_modified = current_metadata.modified()?;
            let current_modified_str: chrono::DateTime<chrono::Utc> = current_modified.into();

            // Parse expected timestamp and compare
            if let Ok(expected_time) = chrono::DateTime::parse_from_rfc3339(expected) {
                let expected_utc = expected_time.with_timezone(&chrono::Utc);
                // Allow small tolerance (1 second) for clock differences
                let diff = current_modified_str.signed_duration_since(expected_utc);
                if diff.num_seconds().abs() > 1 {
                    return Err(AppError::Conflict(
                        "File has been modified externally. Please reload and try again.".into(),
                    ));
                }
            }
        }

        // Atomic write: write to temp file first, then rename
        let temp_path = resolved.with_extension(format!(
            "{}.tmp",
            resolved.extension().unwrap_or_default().to_string_lossy()
        ));

        // Write to temporary file
        std::fs::write(&temp_path, content)?;

        // Rename temp file to target (atomic on same filesystem)
        std::fs::rename(&temp_path, &resolved)?;

        let metadata = std::fs::metadata(&resolved)?;
        let file_size = metadata.len();
        let last_modified = metadata.modified()?;

        Ok((file_size, last_modified))
    }
}

#[cfg(test)]
#[path = "file_service_test.rs"]
mod file_service_test;
