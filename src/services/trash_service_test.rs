use super::*;
use std::fs;

fn setup_test_trash_dir(project_id: i64) -> PathBuf {
    let trash_dir = get_trash_dir().join(project_id.to_string());
    if trash_dir.exists() {
        fs::remove_dir_all(&trash_dir).unwrap_or_default();
    }
    trash_dir
}

fn cleanup_test_trash_dir(project_id: i64) {
    let trash_dir = get_trash_dir().join(project_id.to_string());
    if trash_dir.exists() {
        fs::remove_dir_all(&trash_dir).unwrap_or_default();
    }
}

fn get_test_base_dir() -> PathBuf {
    get_trash_dir().parent().unwrap().to_path_buf()
}

#[test]
fn test_move_file_to_trash_success() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9991");
    fs::create_dir_all(&project_dir).unwrap();

    let file_path = project_dir.join("test.md");
    fs::write(&file_path, "# Test content").unwrap();

    let project_id = 9991i64;
    setup_test_trash_dir(project_id);

    let result = TrashService::move_to_trash(&project_dir, "test.md", false, project_id);
    assert!(result.is_ok());

    let item = result.unwrap();
    assert_eq!(item.original_name, "test.md");
    assert!(!item.is_folder);
    assert!(!file_path.exists());

    let trash_files_dir = get_trash_dir().join(project_id.to_string()).join("files");
    assert!(trash_files_dir.exists());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_move_folder_to_trash_success() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9992");
    fs::create_dir_all(&project_dir).unwrap();

    let folder_path = project_dir.join("docs");
    fs::create_dir_all(&folder_path).unwrap();
    fs::write(folder_path.join("readme.md"), "# Readme").unwrap();
    fs::write(folder_path.join("api.md"), "# API").unwrap();

    let project_id = 9992i64;
    setup_test_trash_dir(project_id);

    let result = TrashService::move_to_trash(&project_dir, "docs", true, project_id);
    assert!(result.is_ok());

    let item = result.unwrap();
    assert_eq!(item.original_name, "docs");
    assert!(item.is_folder);
    assert!(!folder_path.exists());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_move_to_trash_file_not_found() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9993");
    fs::create_dir_all(&project_dir).unwrap();

    let project_id = 9993i64;
    setup_test_trash_dir(project_id);

    let result = TrashService::move_to_trash(&project_dir, "nonexistent.md", false, project_id);
    assert!(result.is_err());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_restore_from_trash_success() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9994");
    fs::create_dir_all(&project_dir).unwrap();

    let file_path = project_dir.join("restore.md");
    fs::write(&file_path, "# Restore test").unwrap();

    let project_id = 9994i64;
    setup_test_trash_dir(project_id);

    let move_result = TrashService::move_to_trash(&project_dir, "restore.md", false, project_id);
    assert!(move_result.is_ok());
    let trash_item_id = move_result.unwrap().id;

    let restore_result = TrashService::restore_from_trash(&project_dir, &trash_item_id, project_id);
    assert!(restore_result.is_ok());
    assert!(file_path.exists());

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "# Restore test");

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_restore_from_trash_item_not_found() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9995");
    fs::create_dir_all(&project_dir).unwrap();

    let project_id = 9995i64;
    setup_test_trash_dir(project_id);

    let result = TrashService::restore_from_trash(&project_dir, "nonexistent_item", project_id);
    assert!(result.is_err());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_delete_from_trash_success() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9996");
    fs::create_dir_all(&project_dir).unwrap();

    let file_path = project_dir.join("delete_forever.md");
    fs::write(&file_path, "# Delete forever").unwrap();

    let project_id = 9996i64;
    setup_test_trash_dir(project_id);

    let move_result =
        TrashService::move_to_trash(&project_dir, "delete_forever.md", false, project_id);
    assert!(move_result.is_ok());
    let trash_item_id = move_result.unwrap().id;

    let trash_file = get_trash_dir()
        .join(project_id.to_string())
        .join("files")
        .join(&trash_item_id);
    assert!(trash_file.exists());

    let delete_result = TrashService::delete_from_trash(project_id, &trash_item_id);
    assert!(delete_result.is_ok());
    assert!(!trash_file.exists());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_clear_trash_success() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9997");
    fs::create_dir_all(&project_dir).unwrap();

    fs::write(project_dir.join("file1.md"), "1").unwrap();
    fs::write(project_dir.join("file2.md"), "2").unwrap();

    let project_id = 9997i64;
    setup_test_trash_dir(project_id);

    TrashService::move_to_trash(&project_dir, "file1.md", false, project_id).unwrap();
    TrashService::move_to_trash(&project_dir, "file2.md", false, project_id).unwrap();

    let items = TrashService::list_trash(project_id).unwrap();
    assert_eq!(items.len(), 2);

    let clear_result = TrashService::clear_trash(project_id);
    assert!(clear_result.is_ok());

    let items_after = TrashService::list_trash(project_id).unwrap();
    assert!(items_after.is_empty());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_list_trash_empty() {
    let project_id = 9998i64;
    setup_test_trash_dir(project_id);

    let items = TrashService::list_trash(project_id).unwrap();
    assert!(items.is_empty());

    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_list_trash_multiple_items() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9999");
    fs::create_dir_all(&project_dir).unwrap();

    fs::write(project_dir.join("a.md"), "a").unwrap();
    fs::write(project_dir.join("b.md"), "b").unwrap();
    fs::write(project_dir.join("c.md"), "c").unwrap();

    let project_id = 9999i64;
    setup_test_trash_dir(project_id);

    TrashService::move_to_trash(&project_dir, "a.md", false, project_id).unwrap();
    TrashService::move_to_trash(&project_dir, "b.md", false, project_id).unwrap();
    TrashService::move_to_trash(&project_dir, "c.md", false, project_id).unwrap();

    let items = TrashService::list_trash(project_id).unwrap();
    assert_eq!(items.len(), 3);

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_is_protected_path_git() {
    let protected_paths = vec![".git".to_string(), ".github".to_string()];
    assert!(TrashService::is_protected_path(".git", &protected_paths));
    assert!(TrashService::is_protected_path(".github", &protected_paths));
    assert!(TrashService::is_protected_path(
        ".git/config",
        &protected_paths
    ));
    assert!(TrashService::is_protected_path(
        "src/.git",
        &protected_paths
    ));
}

#[test]
fn test_is_protected_path_node_modules() {
    let protected_paths = vec!["node_modules".to_string()];
    assert!(TrashService::is_protected_path(
        "node_modules",
        &protected_paths
    ));
    assert!(TrashService::is_protected_path(
        "node_modules/package",
        &protected_paths
    ));
}

#[test]
fn test_is_protected_path_not_protected() {
    let protected_paths = vec![".git".to_string(), "node_modules".to_string()];
    assert!(!TrashService::is_protected_path("src", &protected_paths));
    assert!(!TrashService::is_protected_path(
        "docs/readme.md",
        &protected_paths
    ));
    assert!(!TrashService::is_protected_path(
        "README.md",
        &protected_paths
    ));
}

#[test]
fn test_is_protected_path_case_insensitive() {
    let protected_paths = vec![".git".to_string()];
    assert!(TrashService::is_protected_path(".GIT", &protected_paths));
    assert!(TrashService::is_protected_path(".Git", &protected_paths));
}

#[test]
fn test_get_trash_stats_empty() {
    let project_id = 10000i64;
    setup_test_trash_dir(project_id);

    let stats = TrashService::get_trash_stats(project_id).unwrap();
    assert_eq!(stats.total_items, 0);
    assert_eq!(stats.total_size, 0);
    assert_eq!(stats.oldest_item_age, 0);

    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_get_trash_stats_with_items() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_10001");
    fs::create_dir_all(&project_dir).unwrap();

    fs::write(project_dir.join("stats.md"), "test content for stats").unwrap();

    let project_id = 10001i64;
    setup_test_trash_dir(project_id);

    TrashService::move_to_trash(&project_dir, "stats.md", false, project_id).unwrap();

    let stats = TrashService::get_trash_stats(project_id).unwrap();
    assert_eq!(stats.total_items, 1);
    assert!(stats.total_size > 0);

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_cleanup_expired_trash_no_expired() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_10002");
    fs::create_dir_all(&project_dir).unwrap();

    fs::write(project_dir.join("recent.md"), "recent file").unwrap();

    let project_id = 10002i64;
    setup_test_trash_dir(project_id);

    TrashService::move_to_trash(&project_dir, "recent.md", false, project_id).unwrap();

    let deleted_count = TrashService::cleanup_expired_trash(project_id, 30).unwrap();
    assert_eq!(deleted_count, 0);

    let items = TrashService::list_trash(project_id).unwrap();
    assert_eq!(items.len(), 1);

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_cleanup_all_expired_trash_multiple_projects() {
    let base_dir = get_test_base_dir();
    let project_dir1 = base_dir.join("test_project_10003");
    let project_dir2 = base_dir.join("test_project_10004");
    fs::create_dir_all(&project_dir1).unwrap();
    fs::create_dir_all(&project_dir2).unwrap();

    fs::write(project_dir1.join("p1.md"), "project1").unwrap();
    fs::write(project_dir2.join("p2.md"), "project2").unwrap();

    let project_id1 = 10003i64;
    let project_id2 = 10004i64;

    setup_test_trash_dir(project_id1);
    setup_test_trash_dir(project_id2);

    TrashService::move_to_trash(&project_dir1, "p1.md", false, project_id1).unwrap();
    TrashService::move_to_trash(&project_dir2, "p2.md", false, project_id2).unwrap();

    let total_deleted =
        TrashService::cleanup_all_expired_trash(30, &[project_id1, project_id2]).unwrap();
    assert_eq!(total_deleted, 0);

    fs::remove_dir_all(&project_dir1).unwrap_or_default();
    fs::remove_dir_all(&project_dir2).unwrap_or_default();
    cleanup_test_trash_dir(project_id1);
    cleanup_test_trash_dir(project_id2);
}

#[test]
fn test_validate_relative_path_rejects_absolute() {
    let result = validate_relative_path("/etc/passwd");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)));
}

#[test]
fn test_validate_relative_path_rejects_parent_dir() {
    let result = validate_relative_path("../outside.md");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)));

    let result = validate_relative_path("src/../outside.md");
    assert!(result.is_err());
}

#[test]
fn test_validate_relative_path_accepts_valid() {
    let result = validate_relative_path("docs/readme.md");
    assert!(result.is_ok());
    let path = result.unwrap();
    assert_eq!(path.to_string_lossy(), "docs/readme.md");
}

#[test]
fn test_validate_trash_item_id_rejects_empty() {
    let result = validate_trash_item_id("");
    assert!(result.is_err());
}

#[test]
fn test_validate_trash_item_id_rejects_path_chars() {
    let result = validate_trash_item_id("test/item");
    assert!(result.is_err());
    let result = validate_trash_item_id("test\\item");
    assert!(result.is_err());
    let result = validate_trash_item_id("../escape");
    assert!(result.is_err());
}

#[test]
fn test_validate_trash_item_id_rejects_non_uuid() {
    let result = validate_trash_item_id("1234567890_file.md");
    assert!(result.is_err());
}

#[test]
fn test_validate_trash_item_id_accepts_valid_uuid() {
    let result = validate_trash_item_id("550e8400-e29b-41d4-a716-446655440000");
    assert!(result.is_ok());
}

#[test]
fn test_move_to_trash_rejects_path_traversal() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9001");
    fs::create_dir_all(&project_dir).unwrap();

    let outside_dir = base_dir.join("outside_dir");
    fs::create_dir_all(&outside_dir).unwrap();
    fs::write(outside_dir.join("secret.md"), "secret").unwrap();

    let project_id = 9001i64;
    setup_test_trash_dir(project_id);

    let result =
        TrashService::move_to_trash(&project_dir, "../outside_dir/secret.md", false, project_id);
    assert!(result.is_err());
    assert!(outside_dir.join("secret.md").exists());

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    fs::remove_dir_all(&outside_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}

#[test]
fn test_same_file_consecutive_delete_no_conflict() {
    let base_dir = get_test_base_dir();
    let project_dir = base_dir.join("test_project_9002");
    fs::create_dir_all(&project_dir).unwrap();

    let project_id = 9002i64;
    setup_test_trash_dir(project_id);

    fs::write(project_dir.join("test.md"), "first content").unwrap();
    let result1 = TrashService::move_to_trash(&project_dir, "test.md", false, project_id);
    assert!(result1.is_ok());
    let id1 = result1.unwrap().id;

    fs::write(project_dir.join("test.md"), "second content").unwrap();
    let result2 = TrashService::move_to_trash(&project_dir, "test.md", false, project_id);
    assert!(result2.is_ok());
    let id2 = result2.unwrap().id;

    assert_ne!(id1, id2);

    let items = TrashService::list_trash(project_id).unwrap();
    assert_eq!(items.len(), 2);
    assert!(items.iter().any(|i| i.id == id1));
    assert!(items.iter().any(|i| i.id == id2));

    fs::remove_dir_all(&project_dir).unwrap_or_default();
    cleanup_test_trash_dir(project_id);
}
