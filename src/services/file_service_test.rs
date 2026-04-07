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
    assert_eq!(file_size, 6);
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
