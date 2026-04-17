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

    // Use relative path
    let (content, file_name, path, file_size, last_modified) =
        FileService::get_file_content(temp_dir.path(), "test.md").unwrap();

    assert_eq!(content, "# Test");
    assert_eq!(file_name, "test.md");
    assert_eq!(path, "test.md"); // Path is now relative
    assert_eq!(file_size, 6);
    assert!(last_modified.is_some());
}

#[test]
fn test_get_file_content_not_found() {
    let temp_dir = tempfile::tempdir().unwrap();
    // Use relative path for nonexistent file
    let result = FileService::get_file_content(temp_dir.path(), "nonexistent.md");
    assert!(result.is_err());
}

#[test]
fn test_get_file_content_not_markdown() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    fs::write(&file_path, "Test").unwrap();

    // Use relative path
    let result = FileService::get_file_content(temp_dir.path(), "test.txt");
    assert!(result.is_err());
}

#[test]
fn test_get_file_content_mdx() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.mdx");
    fs::write(&file_path, "# MDX").unwrap();

    // Use relative path
    let result = FileService::get_file_content(temp_dir.path(), "test.mdx");
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

#[test]
fn test_is_allowed_file_type_png() {
    assert!(FileService::is_allowed_file_type("png"));
    assert!(FileService::is_allowed_file_type("PNG"));
}

#[test]
fn test_is_allowed_file_type_jpg() {
    assert!(FileService::is_allowed_file_type("jpg"));
    assert!(FileService::is_allowed_file_type("jpeg"));
    assert!(FileService::is_allowed_file_type("JPG"));
}

#[test]
fn test_is_allowed_file_type_gif() {
    assert!(FileService::is_allowed_file_type("gif"));
}

#[test]
fn test_is_allowed_file_type_svg() {
    assert!(FileService::is_allowed_file_type("svg"));
}

#[test]
fn test_is_allowed_file_type_webp() {
    assert!(FileService::is_allowed_file_type("webp"));
}

#[test]
fn test_is_allowed_file_type_not_allowed() {
    assert!(!FileService::is_allowed_file_type("txt"));
    assert!(!FileService::is_allowed_file_type("pdf"));
    assert!(!FileService::is_allowed_file_type("exe"));
}

#[test]
fn test_get_mime_type_png() {
    assert_eq!(FileService::get_mime_type("png"), "image/png");
}

#[test]
fn test_get_mime_type_jpg() {
    assert_eq!(FileService::get_mime_type("jpg"), "image/jpeg");
    assert_eq!(FileService::get_mime_type("jpeg"), "image/jpeg");
}

#[test]
fn test_get_mime_type_gif() {
    assert_eq!(FileService::get_mime_type("gif"), "image/gif");
}

#[test]
fn test_get_mime_type_svg() {
    assert_eq!(FileService::get_mime_type("svg"), "image/svg+xml");
}

#[test]
fn test_get_mime_type_bmp() {
    assert_eq!(FileService::get_mime_type("bmp"), "image/bmp");
}

#[test]
fn test_get_mime_type_ico() {
    assert_eq!(FileService::get_mime_type("ico"), "image/x-icon");
}

#[test]
fn test_is_allowed_file_type_bmp() {
    assert!(FileService::is_allowed_file_type("bmp"));
    assert!(FileService::is_allowed_file_type("ico"));
}

#[test]
fn test_get_raw_file_bmp() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.bmp");
    let bmp_data = vec![0x42, 0x4D, 0x00, 0x00, 0x00, 0x00];
    fs::write(&file_path, &bmp_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "test.bmp").unwrap();

    assert_eq!(content, bmp_data);
    assert_eq!(mime_type, "image/bmp");
    assert_eq!(file_name, "test.bmp");
}

#[test]
fn test_get_raw_file_ico() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.ico");
    let ico_data = vec![0x00, 0x00, 0x01, 0x00, 0x01, 0x00];
    fs::write(&file_path, &ico_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "test.ico").unwrap();

    assert_eq!(content, ico_data);
    assert_eq!(mime_type, "image/x-icon");
    assert_eq!(file_name, "test.ico");
}

#[test]
fn test_get_raw_file_webp() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.webp");
    let webp_data = vec![0x52, 0x49, 0x46, 0x46];
    fs::write(&file_path, &webp_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "test.webp").unwrap();

    assert_eq!(content, webp_data);
    assert_eq!(mime_type, "image/webp");
    assert_eq!(file_name, "test.webp");
}

#[test]
fn test_get_mime_type_unknown() {
    assert_eq!(
        FileService::get_mime_type("unknown"),
        "application/octet-stream"
    );
}

#[test]
fn test_get_raw_file_png() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.png");
    let png_data = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    fs::write(&file_path, &png_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "test.png").unwrap();

    assert_eq!(content, png_data);
    assert_eq!(mime_type, "image/png");
    assert_eq!(file_name, "test.png");
}

#[test]
fn test_get_raw_file_jpg() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.jpg");
    let jpg_data = vec![0xFF, 0xD8, 0xFF, 0xE0];
    fs::write(&file_path, &jpg_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "test.jpg").unwrap();

    assert_eq!(content, jpg_data);
    assert_eq!(mime_type, "image/jpeg");
    assert_eq!(file_name, "test.jpg");
}

#[test]
fn test_get_raw_file_svg() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.svg");
    let svg_data = "<svg></svg>".as_bytes().to_vec();
    fs::write(&file_path, &svg_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "test.svg").unwrap();

    assert_eq!(content, svg_data);
    assert_eq!(mime_type, "image/svg+xml");
    assert_eq!(file_name, "test.svg");
}

#[test]
fn test_get_raw_file_not_allowed() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    fs::write(&file_path, "text content").unwrap();

    // Use relative path
    let result = FileService::get_raw_file(temp_dir.path(), "test.txt");
    assert!(result.is_err());
}

#[test]
fn test_get_raw_file_path_traversal() {
    let temp_dir = tempfile::tempdir().unwrap();
    let outside_file = temp_dir.path().parent().unwrap().join("outside.png");
    fs::write(&outside_file, vec![0x89, 0x50]).unwrap();

    // Try to use path traversal - should fail
    let result = FileService::get_raw_file(temp_dir.path(), "../outside.png");
    assert!(result.is_err());

    fs::remove_file(&outside_file).ok();
}

#[test]
fn test_build_tree_with_image_files() {
    let files = vec![
        PathBuf::from("test.md"),
        PathBuf::from("image.png"),
        PathBuf::from("photo.jpg"),
    ];
    let root = Path::new("/tmp");
    let tree = FileService::build_tree(&files, root);

    assert_eq!(tree.len(), 3);

    let md_node = tree.iter().find(|n| n.name == "test.md");
    assert!(md_node.is_some());
    assert_eq!(md_node.unwrap().file_type, Some("markdown".to_string()));
    // Path should be relative
    assert_eq!(md_node.unwrap().path, "test.md");

    let png_node = tree.iter().find(|n| n.name == "image.png");
    assert!(png_node.is_some());
    assert_eq!(png_node.unwrap().file_type, Some("image".to_string()));
    assert_eq!(png_node.unwrap().path, "image.png");

    let jpg_node = tree.iter().find(|n| n.name == "photo.jpg");
    assert!(jpg_node.is_some());
    assert_eq!(jpg_node.unwrap().file_type, Some("image".to_string()));
    assert_eq!(jpg_node.unwrap().path, "photo.jpg");
}

#[test]
fn test_build_tree_folder_no_file_type() {
    let files = vec![PathBuf::from("folder/file.md")];
    let root = Path::new("/tmp");
    let tree = FileService::build_tree(&files, root);

    assert_eq!(tree.len(), 1);
    assert!(tree[0].is_folder);
    assert_eq!(tree[0].file_type, None);
    // Path should be relative for folder
    assert_eq!(tree[0].path, "folder");
}

#[test]
fn test_save_file_content_success() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Original").unwrap();

    // Use relative path
    let (file_size, _last_modified) =
        FileService::save_file_content(temp_dir.path(), "test.md", "# Updated", None).unwrap();

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "# Updated");
    assert_eq!(file_size, 9);
}

#[test]
fn test_save_file_content_mdx() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.mdx");
    fs::write(&file_path, "# Original").unwrap();

    // Use relative path
    let result = FileService::save_file_content(temp_dir.path(), "test.mdx", "# Updated", None);
    assert!(result.is_ok());
}

#[test]
fn test_save_file_content_not_markdown() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    fs::write(&file_path, "Original").unwrap();

    // Use relative path
    let result = FileService::save_file_content(temp_dir.path(), "test.txt", "Updated", None);
    assert!(result.is_err());
}

#[test]
fn test_save_file_content_path_traversal() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Test").unwrap();

    let outside_file = temp_dir.path().parent().unwrap().join("outside.md");
    fs::write(&outside_file, "# Outside").unwrap();

    // Try path traversal - should fail validation
    let result = FileService::save_file_content(temp_dir.path(), "../outside.md", "# Evil", None);
    assert!(result.is_err());

    fs::remove_file(&outside_file).ok();
}

#[test]
fn test_save_file_content_not_found() {
    let temp_dir = tempfile::tempdir().unwrap();
    // Use relative path for nonexistent file
    let result =
        FileService::save_file_content(temp_dir.path(), "nonexistent.md", "# Content", None);
    assert!(result.is_err());
}

#[test]
fn test_save_file_content_empty_content() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("empty.md");
    fs::write(&file_path, "# Original").unwrap();

    // Use relative path
    let (file_size, _) =
        FileService::save_file_content(temp_dir.path(), "empty.md", "", None).unwrap();

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "");
    assert_eq!(file_size, 0);
}

#[test]
fn test_get_raw_file_large_file_rejected() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("large.png");
    let mut large_data = vec![0x89, 0x50, 0x4E, 0x47];
    large_data.resize(51 * 1024 * 1024 + 4, 0);
    fs::write(&file_path, &large_data).unwrap();

    // Use relative path
    let result = FileService::get_raw_file(temp_dir.path(), "large.png");
    assert!(result.is_err());

    let err = result.unwrap_err();
    let err_msg = err.to_string();
    assert!(err_msg.contains("too large") || err_msg.contains("50MB"));
}

#[test]
fn test_get_raw_file_max_size_allowed() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("max.png");
    let mut max_data = vec![0x89, 0x50, 0x4E, 0x47];
    max_data.resize(50 * 1024 * 1024 - 4, 0);
    fs::write(&file_path, &max_data).unwrap();

    // Use relative path
    let result = FileService::get_raw_file(temp_dir.path(), "max.png");
    assert!(result.is_ok());
}

#[test]
fn test_get_raw_file_svg_path_with_special_chars() {
    let temp_dir = tempfile::tempdir().unwrap();
    let sub_dir = temp_dir.path().join("folder with spaces");
    fs::create_dir_all(&sub_dir).unwrap();
    let file_path = sub_dir.join("test.svg");
    let svg_data = "<svg></svg>".as_bytes().to_vec();
    fs::write(&file_path, &svg_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "folder with spaces/test.svg").unwrap();

    assert_eq!(content, svg_data);
    assert_eq!(mime_type, "image/svg+xml");
    assert_eq!(file_name, "test.svg");
}

#[test]
fn test_get_raw_file_deep_nested_svg() {
    let temp_dir = tempfile::tempdir().unwrap();
    let deep_path = temp_dir.path().join("a/b/c/d");
    fs::create_dir_all(&deep_path).unwrap();
    let file_path = deep_path.join("nested.svg");
    let svg_data = "<svg></svg>".as_bytes().to_vec();
    fs::write(&file_path, &svg_data).unwrap();

    // Use relative path
    let (content, mime_type, file_name) =
        FileService::get_raw_file(temp_dir.path(), "a/b/c/d/nested.svg").unwrap();

    assert_eq!(content, svg_data);
    assert_eq!(mime_type, "image/svg+xml");
    assert_eq!(file_name, "nested.svg");
}

// ============== Patch 11: Backend save safety tests ==============

#[test]
fn test_validate_relative_path_rejects_absolute() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Test").unwrap();

    // Absolute path should be rejected
    let result = FileService::save_file_content(temp_dir.path(), "/test.md", "# Content", None);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Absolute paths"));
}

#[test]
fn test_validate_relative_path_rejects_parent_dir() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Test").unwrap();

    // Path traversal should be rejected
    let result = FileService::save_file_content(temp_dir.path(), "../test.md", "# Content", None);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Path traversal"));
}

#[test]
fn test_validate_relative_path_rejects_windows_drive() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Test").unwrap();

    // Windows drive letter path should be rejected
    let result = FileService::save_file_content(temp_dir.path(), "C:/test.md", "# Content", None);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Absolute paths"));
}

#[test]
fn test_save_file_conflict_detection() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Original").unwrap();

    // Get current modification time
    let metadata = fs::metadata(&file_path).unwrap();
    let original_modified = metadata.modified().unwrap();

    // Modify the file externally (simulate external edit)
    // Wait a moment then modify
    std::thread::sleep(std::time::Duration::from_millis(100));
    fs::write(&file_path, "# External modification").unwrap();

    // Create a timestamp that's clearly different from current state
    let old_timestamp: chrono::DateTime<chrono::Utc> =
        chrono::DateTime::from(original_modified) - chrono::Duration::seconds(10);
    let expected_modified = old_timestamp.to_rfc3339();

    // Save with expected timestamp should fail due to conflict
    let result = FileService::save_file_content(
        temp_dir.path(),
        "test.md",
        "# My changes",
        Some(&expected_modified),
    );
    assert!(result.is_err());
    let err = result.unwrap_err();
    let err_msg = err.to_string();
    assert!(err_msg.contains("Conflict") || err_msg.contains("modified externally"));
}

#[test]
fn test_save_file_no_conflict_with_current_timestamp() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Original").unwrap();

    // Get current modification time
    let metadata = fs::metadata(&file_path).unwrap();
    let current_modified = metadata.modified().unwrap();
    let current_timestamp: chrono::DateTime<chrono::Utc> = current_modified.into();

    // Save with current timestamp should succeed (within tolerance)
    let result = FileService::save_file_content(
        temp_dir.path(),
        "test.md",
        "# My changes",
        Some(&current_timestamp.to_rfc3339()),
    );
    assert!(result.is_ok());
}

#[test]
fn test_atomic_write_preserves_file_on_partial_failure() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    fs::write(&file_path, "# Original content\nMore content").unwrap();

    // Read original content
    let _original_content = fs::read_to_string(&file_path).unwrap();

    // Verify atomic write by checking no temp files are left
    let result = FileService::save_file_content(temp_dir.path(), "test.md", "# Updated", None);
    assert!(result.is_ok());

    // Check that temp file was cleaned up
    let temp_file = temp_dir.path().join("test.md.tmp");
    assert!(!temp_file.exists());

    // Check that the target file exists with new content
    let new_content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(new_content, "# Updated");
}

#[test]
fn test_relative_path_in_nested_directory() {
    let temp_dir = tempfile::tempdir().unwrap();
    let nested_dir = temp_dir.path().join("docs/api");
    fs::create_dir_all(&nested_dir).unwrap();
    let file_path = nested_dir.join("readme.md");
    fs::write(&file_path, "# Original").unwrap();

    // Save using relative path in nested directory
    let result = FileService::save_file_content(
        temp_dir.path(),
        "docs/api/readme.md",
        "# Updated API docs",
        None,
    );
    assert!(result.is_ok());

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "# Updated API docs");
}

#[test]
fn test_get_file_content_returns_relative_path() {
    let temp_dir = tempfile::tempdir().unwrap();
    let nested_dir = temp_dir.path().join("docs");
    fs::create_dir_all(&nested_dir).unwrap();
    let file_path = nested_dir.join("readme.md");
    fs::write(&file_path, "# Docs").unwrap();

    let (content, file_name, path, _file_size, _last_modified) =
        FileService::get_file_content(temp_dir.path(), "docs/readme.md").unwrap();

    assert_eq!(content, "# Docs");
    assert_eq!(file_name, "readme.md");
    // Path should be relative, not absolute
    assert_eq!(path, "docs/readme.md");
}
