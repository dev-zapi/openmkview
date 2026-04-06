use crate::errors::{AppError, AppResult};
use crate::models::FileTreeNode;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub struct FileService;

impl FileService {
    pub fn build_tree(files: &[PathBuf], root_path: &Path) -> Vec<FileTreeNode> {
        fn build_node(
            files: &[&PathBuf],
            depth: usize,
            current_prefix: &str,
            root_path: &Path,
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
                        let full_path = root_path.join(file);
                        nodes.push(FileTreeNode {
                            id: file.to_str().unwrap().to_string(),
                            name: name.clone(),
                            path: full_path.to_str().unwrap().to_string(),
                            is_folder: false,
                            children: None,
                        });
                    }
                } else {
                    let child_prefix = if current_prefix.is_empty() {
                        name.clone()
                    } else {
                        format!("{}/{}", current_prefix, name)
                    };
                    let children = build_node(&group_files, depth + 1, &child_prefix, root_path);
                    nodes.push(FileTreeNode {
                        id: child_prefix.clone(),
                        name,
                        path: root_path.join(&child_prefix).to_str().unwrap().to_string(),
                        is_folder: true,
                        children: Some(children),
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
        file_path: &str,
    ) -> AppResult<(String, String, String, u64, Option<std::time::SystemTime>)> {
        let file_path = PathBuf::from(file_path);
        let resolved = file_path
            .canonicalize()
            .map_err(|_| AppError::NotFound("文件不存在".into()))?;

        let project_resolved = project_path
            .canonicalize()
            .map_err(|_| AppError::FileError("项目路径无效".into()))?;

        if !resolved.starts_with(&project_resolved) {
            return Err(AppError::ValidationError("访问被拒绝".into()));
        }

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if ext != Some("md".to_string()) && ext != Some("mdx".to_string()) {
            return Err(AppError::BadRequest("只支持 Markdown 文件".into()));
        }

        let content = std::fs::read_to_string(&resolved)?;
        let file_name = resolved.file_name().unwrap().to_str().unwrap().to_string();
        let path = resolved.to_str().unwrap().to_string();

        // 获取文件大小和修改时间
        let metadata = std::fs::metadata(&resolved)?;
        let file_size = metadata.len();
        let last_modified = metadata.modified().ok();

        Ok((content, file_name, path, file_size, last_modified))
    }

    pub fn create_file(project_path: &Path, file_name: &str) -> AppResult<()> {
        let file_path = project_path.join(file_name);

        if file_path.exists() {
            return Err(AppError::BadRequest("文件已存在".into()));
        }

        std::fs::write(&file_path, "")?;
        Ok(())
    }

    pub fn rename_file(project_path: &Path, old_path: &str, new_name: &str) -> AppResult<()> {
        let old_path = project_path.join(old_path);
        let new_path = old_path.parent().unwrap().join(new_name);

        if !old_path.exists() {
            return Err(AppError::NotFound("文件不存在".into()));
        }

        if new_path.exists() {
            return Err(AppError::BadRequest("目标文件已存在".into()));
        }

        std::fs::rename(&old_path, &new_path)?;
        Ok(())
    }

    pub fn delete_file(project_path: &Path, file_path: &str) -> AppResult<()> {
        let file_path = project_path.join(file_path);

        if !file_path.exists() {
            return Err(AppError::NotFound("文件不存在".into()));
        }

        std::fs::remove_file(&file_path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_build_tree_empty_files() {
        let files: Vec<PathBuf> = vec![];
        let root = Path::new("/tmp");
        let tree = FileService::build_tree(&files, root);
        assert!(tree.is_empty());
    }

    #[test]
    fn test_build_tree_single_file() {
        let files = vec![PathBuf::from("test.md")];
        let root = Path::new("/tmp");
        let tree = FileService::build_tree(&files, root);
        assert_eq!(tree.len(), 1);
        assert!(!tree[0].is_folder);
        assert_eq!(tree[0].name, "test.md");
    }

    #[test]
    fn test_build_tree_nested_files() {
        let files = vec![
            PathBuf::from("folder1/file1.md"),
            PathBuf::from("folder1/file2.md"),
            PathBuf::from("folder2/file3.md"),
        ];
        let root = Path::new("/tmp");
        let tree = FileService::build_tree(&files, root);
        assert_eq!(tree.len(), 2);
        assert!(tree.iter().all(|n| n.is_folder));
    }

    #[test]
    fn test_build_tree_sorts_folders_first() {
        let files = vec![PathBuf::from("file.md"), PathBuf::from("folder/file.md")];
        let root = Path::new("/tmp");
        let tree = FileService::build_tree(&files, root);
        assert_eq!(tree.len(), 2);
        if tree[0].is_folder {
            assert!(!tree[1].is_folder);
        }
    }

    #[test]
    fn test_build_tree_deep_nesting() {
        let files = vec![PathBuf::from("a/b/c/d.md")];
        let root = Path::new("/tmp");
        let tree = FileService::build_tree(&files, root);
        assert_eq!(tree.len(), 1);
        assert!(tree[0].is_folder);
        assert_eq!(tree[0].name, "a");
    }

    #[test]
    fn test_get_file_content_success() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.md");
        fs::write(&file_path, "# Test").unwrap();

        let (content, file_name, path, file_size, last_modified) =
            FileService::get_file_content(temp_dir.path(), file_path.to_str().unwrap()).unwrap();

        assert_eq!(content, "# Test");
        assert_eq!(file_name, "test.md");
        assert!(path.ends_with("test.md"));
        assert_eq!(file_size, 6); // "# Test" = 6 bytes
        assert!(last_modified.is_some());
    }

    #[test]
    fn test_get_file_content_not_found() {
        let temp_dir = tempfile::tempdir().unwrap();
        let result = FileService::get_file_content(temp_dir.path(), "/nonexistent/path/file.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_file_content_not_markdown() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Test").unwrap();

        let result = FileService::get_file_content(temp_dir.path(), file_path.to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_get_file_content_mdx() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.mdx");
        fs::write(&file_path, "# MDX").unwrap();

        let result = FileService::get_file_content(temp_dir.path(), file_path.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_file_success() {
        let temp_dir = tempfile::tempdir().unwrap();
        let result = FileService::create_file(temp_dir.path(), "new.md");
        assert!(result.is_ok());
        assert!(temp_dir.path().join("new.md").exists());
    }

    #[test]
    fn test_create_file_already_exists() {
        let temp_dir = tempfile::tempdir().unwrap();
        fs::write(temp_dir.path().join("exists.md"), "").unwrap();

        let result = FileService::create_file(temp_dir.path(), "exists.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_rename_file_success() {
        let temp_dir = tempfile::tempdir().unwrap();
        let old_path = temp_dir.path().join("old.md");
        fs::write(&old_path, "").unwrap();

        let result = FileService::rename_file(temp_dir.path(), "old.md", "new.md");
        assert!(result.is_ok());
        assert!(!old_path.exists());
        assert!(temp_dir.path().join("new.md").exists());
    }

    #[test]
    fn test_rename_file_not_found() {
        let temp_dir = tempfile::tempdir().unwrap();
        let result = FileService::rename_file(temp_dir.path(), "nonexistent.md", "new.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_file_success() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("delete.md");
        fs::write(&file_path, "").unwrap();

        let result = FileService::delete_file(temp_dir.path(), "delete.md");
        assert!(result.is_ok());
        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_file_not_found() {
        let temp_dir = tempfile::tempdir().unwrap();
        let result = FileService::delete_file(temp_dir.path(), "nonexistent.md");
        assert!(result.is_err());
    }
}
