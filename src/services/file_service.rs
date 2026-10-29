use crate::errors::{AppError, AppResult};
use crate::models::FileTreeNode;
use std::collections::BTreeMap;
use std::io::Read;
use std::path::{Path, PathBuf};

pub struct FileService;

/// Result of reading a file for the content endpoint.
pub struct FileContentResult {
    pub content: String,
    pub file_name: String,
    pub path: String,
    pub file_size: u64,
    /// Byte size of the file on disk (same as `file_size`, kept for the new
    /// response contract).
    pub size: u64,
    pub last_modified: Option<std::time::SystemTime>,
    /// Content was cut at the 1 MB limit.
    pub truncated: bool,
    /// Source bytes were not valid UTF-8 and were lossily decoded.
    pub lossy: bool,
    /// File looks binary (NUL byte in the first 8 KB); content is empty.
    pub binary: bool,
}

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Maximum number of bytes returned by the relaxed file-content endpoint.
const MAX_CONTENT_SIZE: usize = 1024 * 1024;

/// Number of leading bytes inspected when sniffing for binary content.
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

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

    /// Classify a file for the tree's `fileType` field.
    ///
    /// Markdown, HTML and images keep their dedicated renderers; everything
    /// else is `other` and opens in the Source Fallback view.
    pub fn classify_file_type(ext: Option<&str>) -> String {
        match ext.map(|e| e.to_lowercase()) {
            Some(ext) if ext == "md" || ext == "mdx" => "markdown".to_string(),
            Some(ext) if ext == "html" || ext == "htm" => "html".to_string(),
            Some(ext) if Self::is_allowed_file_type(&ext) => "image".to_string(),
            _ => "other".to_string(),
        }
    }

    /// True when any component of a relative path starts with a dot.
    fn is_hidden_path(relative_path: &str) -> bool {
        // A backslash is a path separator only on Windows; on Unix it is an
        // ordinary filename character and must not split components.
        #[cfg(windows)]
        let mut components = relative_path.split(['/', '\\']);
        #[cfg(not(windows))]
        let mut components = relative_path.split('/');

        components
            .any(|component| component.starts_with('.') && component != "." && component != "..")
    }

    /// Convert a path relative to the project root into the forward-slash
    /// string used as a node id/path.
    ///
    /// Returns `None` for non-UTF-8 paths: they cannot round-trip through the
    /// JSON tree, so they must be skipped rather than lossily encoded.
    fn relative_path_to_string(relative_path: &Path) -> Option<String> {
        let raw = relative_path.to_str()?;
        #[cfg(windows)]
        {
            Some(raw.replace('\\', "/"))
        }
        #[cfg(not(windows))]
        {
            Some(raw.to_string())
        }
    }

    fn is_placeholder_dir(name: &str, placeholder_dirs: &[String]) -> bool {
        placeholder_dirs.iter().any(|dir| dir == name)
    }

    fn is_ignored_file(name: &str, ignored_files: &[String]) -> bool {
        ignored_files.iter().any(|file| file == name)
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
            }
            .to_string()
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
                        let node_type = Some(FileService::classify_file_type(file_type.as_deref()));

                        nodes.push(FileTreeNode {
                            id: relative_path.clone(),
                            name: name.clone(),
                            path: relative_path.clone(), // Return relative path
                            is_folder: false,
                            children: None,
                            file_type: node_type,
                            hidden: FileService::is_hidden_path(&relative_path),
                            is_placeholder: false,
                            size: 0,
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
                        path: child_prefix.clone(), // Return relative path for folders too
                        is_folder: true,
                        children: Some(children),
                        file_type: None,
                        hidden: FileService::is_hidden_path(&child_prefix),
                        is_placeholder: false,
                        size: 0,
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

    /// Build the tree by walking the real filesystem.
    ///
    /// Every file and directory under `root_path` becomes a node, including
    /// empty directories and directories that only contain hidden entries.
    /// Ignored files are skipped. Placeholder directories are emitted but not
    /// descended into.
    pub fn build_tree_from_fs(
        root_path: &Path,
        placeholder_dirs: &[String],
        ignored_files: &[String],
    ) -> Vec<FileTreeNode> {
        let canonical_root = root_path
            .canonicalize()
            .unwrap_or_else(|_| root_path.to_path_buf());
        let mut ancestors = Vec::new();
        Self::walk_directory(
            root_path,
            root_path,
            &canonical_root,
            placeholder_dirs,
            ignored_files,
            &mut ancestors,
        )
    }

    fn walk_directory(
        dir: &Path,
        root: &Path,
        canonical_root: &Path,
        placeholder_dirs: &[String],
        ignored_files: &[String],
        ancestors: &mut Vec<PathBuf>,
    ) -> Vec<FileTreeNode> {
        let mut nodes = Vec::new();

        // Cycle guard: a directory already on the current descent path means a
        // symlink loop; stop instead of recursing forever.
        let canonical_dir = match dir.canonicalize() {
            Ok(path) => path,
            Err(_) => return nodes,
        };
        if ancestors.contains(&canonical_dir) {
            return nodes;
        }
        ancestors.push(canonical_dir);

        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            // Unreadable directories are skipped rather than failing the whole tree.
            Err(_) => {
                ancestors.pop();
                return nodes;
            }
        };

        for entry in entries.flatten() {
            // Non-UTF-8 names cannot round-trip through the JSON tree, so they
            // are skipped instead of lossily encoded.
            let name = match entry.file_name().into_string() {
                Ok(name) => name,
                Err(_) => continue,
            };
            if name.is_empty() {
                continue;
            }

            let path = entry.path();
            let relative_path = path.strip_prefix(root).unwrap_or(&path);
            let relative_str = match Self::relative_path_to_string(relative_path) {
                Some(relative_str) => relative_str,
                None => continue,
            };
            let hidden = Self::is_hidden_path(&relative_str);

            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };

            if file_type.is_file() {
                if Self::is_ignored_file(&name, ignored_files) {
                    continue;
                }
                let size = entry.metadata().map(|meta| meta.len()).unwrap_or(0);
                nodes.push(FileTreeNode {
                    id: relative_str.clone(),
                    name,
                    path: relative_str,
                    is_folder: false,
                    children: None,
                    file_type: Some(Self::classify_file_type(
                        path.extension().and_then(|e| e.to_str()),
                    )),
                    hidden,
                    is_placeholder: false,
                    size,
                });
            } else if file_type.is_dir() {
                let is_placeholder = Self::is_placeholder_dir(&name, placeholder_dirs);
                let children = if is_placeholder {
                    None
                } else {
                    Some(Self::walk_directory(
                        &path,
                        root,
                        canonical_root,
                        placeholder_dirs,
                        ignored_files,
                        ancestors,
                    ))
                };
                nodes.push(FileTreeNode {
                    id: relative_str.clone(),
                    name,
                    path: relative_str,
                    is_folder: true,
                    children,
                    file_type: None,
                    hidden,
                    is_placeholder,
                    size: 0,
                });
            } else if file_type.is_symlink() {
                // Resolve symlinks. Symlinked directories are followed only when
                // their target stays inside the project root; cycles are caught
                // by the ancestor chain.
                if let Ok(meta) = std::fs::metadata(&path) {
                    if meta.is_file() {
                        if Self::is_ignored_file(&name, ignored_files) {
                            continue;
                        }
                        nodes.push(FileTreeNode {
                            id: relative_str.clone(),
                            name,
                            path: relative_str,
                            is_folder: false,
                            children: None,
                            file_type: Some(Self::classify_file_type(
                                path.extension().and_then(|e| e.to_str()),
                            )),
                            hidden,
                            is_placeholder: false,
                            size: meta.len(),
                        });
                    } else if meta.is_dir() {
                        let is_placeholder = Self::is_placeholder_dir(&name, placeholder_dirs);
                        let children = if is_placeholder {
                            None
                        } else {
                            let target_inside_root = path
                                .canonicalize()
                                .map(|target| target.starts_with(canonical_root))
                                .unwrap_or(false);
                            if target_inside_root {
                                Some(Self::walk_directory(
                                    &path,
                                    root,
                                    canonical_root,
                                    placeholder_dirs,
                                    ignored_files,
                                    ancestors,
                                ))
                            } else {
                                // Links escaping the project root are shown but
                                // never expanded.
                                Some(Vec::new())
                            }
                        };
                        nodes.push(FileTreeNode {
                            id: relative_str.clone(),
                            name,
                            path: relative_str,
                            is_folder: true,
                            children,
                            file_type: None,
                            hidden,
                            is_placeholder,
                            size: 0,
                        });
                    }
                }
            }
        }

        ancestors.pop();
        Self::sort_tree(&mut nodes);
        nodes
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
    ) -> AppResult<FileContentResult> {
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

        if resolved.is_dir() {
            return Err(AppError::BadRequest("Path is a directory".into()));
        }

        let file_name = resolved
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        // Return relative path for frontend
        let path = relative_path.to_string();

        // Get file size and modification time
        let metadata = std::fs::metadata(&resolved)?;

        // Only regular files are readable. Directories are handled above;
        // FIFOs, sockets and devices would block or misbehave on read.
        if !metadata.file_type().is_file() {
            return Err(AppError::BadRequest("Path is not a regular file".into()));
        }

        let file_size = metadata.len();
        let last_modified = metadata.modified().ok();

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        // Markdown and HTML keep their existing, strict reading behavior.
        if ext
            .as_deref()
            .is_some_and(FileService::is_document_file_type)
        {
            let content = std::fs::read_to_string(&resolved)?;
            return Ok(FileContentResult {
                content,
                file_name,
                path,
                file_size,
                size: file_size,
                last_modified,
                truncated: false,
                lossy: false,
                binary: false,
            });
        }

        // Every other file type is read as bytes: binary sniff, lossy decode
        // and truncation at 1 MB. Read at most one byte past the truncation
        // limit so huge files never land in memory whole.
        let read_limit = (MAX_CONTENT_SIZE as u64).saturating_add(1);
        let mut bytes = Vec::new();
        {
            let file = std::fs::File::open(&resolved)?;
            file.take(read_limit).read_to_end(&mut bytes)?;
        }
        let size = file_size;
        let binary = bytes.iter().take(BINARY_SNIFF_BYTES).any(|byte| *byte == 0);

        if binary {
            return Ok(FileContentResult {
                content: String::new(),
                file_name,
                path,
                file_size: size,
                size,
                last_modified,
                truncated: false,
                lossy: false,
                binary: true,
            });
        }

        let truncated = bytes.len() > MAX_CONTENT_SIZE;
        let slice = &bytes[..bytes.len().min(MAX_CONTENT_SIZE)];
        let lossy = std::str::from_utf8(slice).is_err();
        let content = String::from_utf8_lossy(slice).to_string();

        Ok(FileContentResult {
            content,
            file_name,
            path,
            file_size: size,
            size,
            last_modified,
            truncated,
            lossy,
            binary: false,
        })
    }

    pub fn create_file(project_path: &Path, file_name: &str) -> AppResult<()> {
        let file_path = Self::resolve_new_project_path(project_path, file_name)?;

        if file_path.exists() {
            return Err(AppError::BadRequest("File already exists".into()));
        }

        std::fs::write(&file_path, "")?;
        Ok(())
    }

    /// Move a file or directory to a different directory within the same project.
    ///
    /// `from` is the relative source path (file or directory).
    /// `to` is the relative target directory path (empty string for project root).
    pub fn move_file(project_path: &Path, from: &str, to: &str) -> AppResult<()> {
        // Validate and resolve the source (must exist)
        let from_path = Self::resolve_existing_project_path(project_path, from)?;

        // Resolve the target directory (must exist and be a directory)
        let to_dir = if to.is_empty() || to == "." || to == "/" {
            Self::canonical_project_path(project_path)?
        } else {
            Self::resolve_existing_project_path(project_path, to)?
        };

        if !to_dir.is_dir() {
            return Err(AppError::BadRequest("Target must be a directory".into()));
        }

        // Get the source name (file or directory name)
        let source_name = from_path
            .file_name()
            .ok_or_else(|| AppError::ValidationError("Invalid source path".into()))?;

        // Build the destination path
        let dest_path = to_dir.join(source_name);

        // Collision check
        if dest_path.exists() {
            return Err(AppError::BadRequest(format!(
                "A file or directory named '{}' already exists at the destination",
                source_name.to_string_lossy()
            )));
        }

        // Cycle prevention: cannot move a directory into itself or its descendants
        if from_path.is_dir() && to_dir.starts_with(&from_path) {
            return Err(AppError::BadRequest(
                "Cannot move a directory into itself or one of its subdirectories".into(),
            ));
        }

        // Perform the move
        std::fs::rename(&from_path, &dest_path)?;

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
