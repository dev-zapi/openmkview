use super::*;
use std::fs::{self, File};
use tempfile::TempDir;

#[test]
fn test_is_hidden_with_dot_prefix() {
    let temp_dir = TempDir::new().unwrap();
    let hidden_file = temp_dir.path().join(".hidden");
    File::create(&hidden_file).unwrap();

    let entry = walkdir::WalkDir::new(temp_dir.path())
        .into_iter()
        .find(|e| e.as_ref().unwrap().file_name() == ".hidden")
        .unwrap()
        .unwrap();

    assert!(is_hidden(&entry));
}

#[test]
fn test_is_hidden_without_dot_prefix() {
    let temp_dir = TempDir::new().unwrap();
    let normal_file = temp_dir.path().join("normal");
    File::create(&normal_file).unwrap();

    let entry = walkdir::WalkDir::new(temp_dir.path())
        .into_iter()
        .find(|e| e.as_ref().unwrap().file_name() == "normal")
        .unwrap()
        .unwrap();

    assert!(!is_hidden(&entry));
}

#[test]
fn test_extract_path_absolute() {
    let (base, term) = extract_path_and_term("/home/user/projects/src/main");
    assert_eq!(base, Some(PathBuf::from("/home/user/projects/src")));
    assert_eq!(term, "main");
}

#[test]
fn test_extract_path_relative() {
    let (base, term) = extract_path_and_term("src/main");
    assert_eq!(base, Some(PathBuf::from("src")));
    assert_eq!(term, "main");
}

#[test]
fn test_extract_path_hidden_directory() {
    let (base, term) = extract_path_and_term(".openclaw/w");
    assert_eq!(base, Some(PathBuf::from(".openclaw")));
    assert_eq!(term, "w");
}

#[test]
fn test_extract_path_relative_with_dot() {
    let (base, term) = extract_path_and_term("./.openclaw/w");
    assert_eq!(base, Some(PathBuf::from("./.openclaw")));
    assert_eq!(term, "w");
}

#[test]
fn test_extract_path_relative_without_dot() {
    let (base, term) = extract_path_and_term("./openclaw/w");
    assert_eq!(base, Some(PathBuf::from("./openclaw")));
    assert_eq!(term, "w");
}

#[test]
fn test_extract_path_single_component() {
    let (base, term) = extract_path_and_term("filename");
    assert_eq!(base, None);
    assert_eq!(term, "filename");
}

#[test]
fn test_extract_path_root_only() {
    let (_base, term) = extract_path_and_term("/");
    assert_eq!(term, "/");
}

#[test]
fn test_extract_path_nested() {
    let (base, term) = extract_path_and_term("src/projects/myapp/main");
    assert_eq!(base, Some(PathBuf::from("src/projects/myapp")));
    assert_eq!(term, "main");
}

#[test]
fn test_extract_path_trailing_slash_relative() {
    let (base, term) = extract_path_and_term(".openclaw/");
    assert_eq!(base, Some(PathBuf::from(".openclaw")));
    assert_eq!(term, "");
}

#[test]
fn test_extract_path_trailing_slash_absolute() {
    let (base, term) = extract_path_and_term("/home/user/projects/");
    assert_eq!(base, Some(PathBuf::from("/home/user/projects")));
    assert_eq!(term, "");
}

#[test]
fn test_extract_path_trailing_slash_nested() {
    let (base, term) = extract_path_and_term("src/components/");
    assert_eq!(base, Some(PathBuf::from("src/components")));
    assert_eq!(term, "");
}

#[test]
fn test_extract_path_trailing_slash_with_dot() {
    let (base, term) = extract_path_and_term("./.openclaw/");
    assert_eq!(base, Some(PathBuf::from("./.openclaw")));
    assert_eq!(term, "");
}

#[test]
fn test_search_with_depth_basic() {
    let temp_dir = TempDir::new().unwrap();
    let file1 = temp_dir.path().join("main.rs");
    let file2 = temp_dir.path().join("test.rs");
    File::create(&file1).unwrap();
    File::create(&file2).unwrap();

    let candidates = search_with_depth(temp_dir.path(), "main", 1, true);

    assert!(!candidates.is_empty());
    assert!(candidates.iter().any(|c| c.name == "main.rs"));
    let main_candidate = candidates.iter().find(|c| c.name == "main.rs");
    assert!(main_candidate.is_some());
    assert_eq!(main_candidate.unwrap().depth, 1);
}

#[test]
fn test_search_with_depth_multiple_matches() {
    let temp_dir = TempDir::new().unwrap();
    let file1 = temp_dir.path().join("main.rs");
    let file2 = temp_dir.path().join("main.c");
    let file3 = temp_dir.path().join("other.txt");
    File::create(&file1).unwrap();
    File::create(&file2).unwrap();
    File::create(&file3).unwrap();

    let candidates = search_with_depth(temp_dir.path(), "main", 1, true);

    assert!(candidates.len() >= 2);
    let names: Vec<&str> = candidates.iter().map(|c| c.name.as_str()).collect();
    assert!(names.contains(&"main.rs"));
    assert!(names.contains(&"main.c"));
    for candidate in candidates.iter().filter(|c| c.name.starts_with("main")) {
        assert_eq!(candidate.depth, 1);
    }
}

#[test]
fn test_search_with_depth_case_insensitive() {
    let temp_dir = TempDir::new().unwrap();
    let file = temp_dir.path().join("Main.rs");
    File::create(&file).unwrap();

    let candidates = search_with_depth(temp_dir.path(), "main", 1, true);

    assert!(!candidates.is_empty());
    assert!(candidates.iter().any(|c| c.name == "Main.rs"));
}

#[test]
fn test_search_with_depth_hidden_files_excluded() {
    let temp_base = TempDir::new().unwrap();
    let normal_dir = temp_base.path().join("normaldir");
    fs::create_dir(&normal_dir).unwrap();

    let hidden_file = normal_dir.join(".hidden.txt");
    let normal_file = normal_dir.join("normal.txt");
    File::create(&hidden_file).unwrap();
    File::create(&normal_file).unwrap();

    let candidates = search_with_depth(&normal_dir, "hidden", 1, false);

    assert_eq!(candidates.len(), 0);
}

#[test]
fn test_search_with_depth_hidden_files_included() {
    let temp_base = TempDir::new().unwrap();
    let normal_dir = temp_base.path().join("normaldir");
    fs::create_dir(&normal_dir).unwrap();

    let hidden_file = normal_dir.join(".hidden.txt");
    let normal_file = normal_dir.join("normal.txt");
    File::create(&hidden_file).unwrap();
    File::create(&normal_file).unwrap();

    let candidates = search_with_depth(&normal_dir, "hidden", 1, true);

    assert!(!candidates.is_empty());
    assert!(candidates.iter().any(|c| c.name == ".hidden.txt"));
}

#[test]
fn test_search_with_depth_subdirectories() {
    let temp_dir = TempDir::new().unwrap();
    let subdir = temp_dir.path().join("src");
    fs::create_dir(&subdir).unwrap();
    let file = subdir.join("main.rs");
    File::create(&file).unwrap();

    let candidates_depth1 = search_with_depth(temp_dir.path(), "main", 1, true);
    assert!(!candidates_depth1.iter().any(|c| c.name == "main.rs"));

    let candidates_depth2 = search_with_depth(temp_dir.path(), "main", 2, true);
    assert!(candidates_depth2.iter().any(|c| c.name == "main.rs"));
    let main_candidate = candidates_depth2.iter().find(|c| c.name == "main.rs");
    assert_eq!(main_candidate.unwrap().depth, 2);
}

#[test]
fn test_search_with_depth_relative_path() {
    let temp_dir = TempDir::new().unwrap();
    let file = temp_dir.path().join("test_file.txt");
    File::create(&file).unwrap();

    let candidates = search_with_depth(temp_dir.path(), "test_file", 1, true);

    assert!(!candidates.is_empty());
    let test_candidate = candidates.iter().find(|c| c.name == "test_file.txt");
    assert!(test_candidate.is_some());
    assert_eq!(test_candidate.unwrap().relative_path, "test_file.txt");
}

#[test]
fn test_resolve_path_absolute_existing_base() {
    let temp_dir = TempDir::new().unwrap();
    let file = temp_dir.path().join("main.rs");
    File::create(&file).unwrap();

    let path_input = format!("{}/main", temp_dir.path().display());
    let response = PathSearchService::resolve_path(&path_input);

    assert_eq!(response.path_type, PathType::Absolute);
    assert!(response.candidates.iter().any(|c| c.name == "main.rs"));
}

#[test]
fn test_resolve_path_absolute_non_existing_base() {
    let path_input = "/nonexistent/path/main";
    let response = PathSearchService::resolve_path(path_input);

    assert_eq!(response.path_type, PathType::Absolute);
    assert_eq!(response.candidates.len(), 0);
}

#[test]
fn test_resolve_path_relative_existing_base() {
    let home_dir = dirs::home_dir().expect("Cannot get home directory");
    let test_dir_name = ".test_openmkview_relative_existing";
    let test_dir = home_dir.join(test_dir_name);

    if test_dir.exists() {
        fs::remove_dir_all(&test_dir).unwrap();
    }
    fs::create_dir_all(&test_dir).unwrap();

    let subdir = test_dir.join("src");
    fs::create_dir(&subdir).unwrap();
    let file = subdir.join("main.rs");
    File::create(&file).unwrap();

    let response = PathSearchService::resolve_path("src/main");

    assert_eq!(response.path_type, PathType::Relative);
    assert!(response.candidates.iter().any(|c| c.name == "main.rs"));

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_resolve_path_relative_hidden_directory() {
    let home_dir = dirs::home_dir().expect("Cannot get home directory");
    let test_dir_name = ".test_openmkview_hidden";
    let test_dir = home_dir.join(test_dir_name);

    if test_dir.exists() {
        fs::remove_dir_all(&test_dir).unwrap();
    }
    fs::create_dir_all(&test_dir).unwrap();

    let hidden_dir = test_dir.join(".openclaw_test");
    fs::create_dir(&hidden_dir).unwrap();
    let file = hidden_dir.join("workspace.md");
    File::create(&file).unwrap();

    let response = PathSearchService::resolve_path(".openclaw_test/w");

    assert_eq!(response.path_type, PathType::Relative);
    assert!(response.candidates.iter().any(|c| c.name == "workspace.md"));

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_resolve_path_relative_non_existing_base_fuzzy_search() {
    let home_dir = dirs::home_dir().expect("Cannot get home directory");
    let test_dir_name = ".test_openmkview_fuzzy_search";
    let test_dir = home_dir.join(test_dir_name);

    if test_dir.exists() {
        fs::remove_dir_all(&test_dir).unwrap();
    }
    fs::create_dir_all(&test_dir).unwrap();

    let openclaw = test_dir.join("openclaw_test");
    fs::create_dir(&openclaw).unwrap();

    let file = openclaw.join("worker.md");
    File::create(&file).unwrap();

    let response = PathSearchService::resolve_path("openclaw_test/w");
    assert_eq!(response.path_type, PathType::Relative);
    assert!(response.candidates.iter().any(|c| c.name == "worker.md"));

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_resolve_path_exact_directory_match() {
    let home_dir = dirs::home_dir().expect("Cannot get home directory");
    let test_dir_name = ".test_openmkview_exact_match";
    let test_dir = home_dir.join(test_dir_name);

    if test_dir.exists() {
        fs::remove_dir_all(&test_dir).unwrap();
    }
    fs::create_dir_all(&test_dir).unwrap();

    let exact = test_dir.join(".openclaw_test_exact");
    let fuzzy = test_dir.join("xxx.openclaw_test_exact");
    let normal = test_dir.join("openclaw_test_exact");
    fs::create_dir(&exact).unwrap();
    fs::create_dir(&fuzzy).unwrap();
    fs::create_dir(&normal).unwrap();

    File::create(exact.join("exact_w.md")).unwrap();
    File::create(fuzzy.join("fuzzy_w.md")).unwrap();
    File::create(normal.join("normal_w.md")).unwrap();

    let response = PathSearchService::resolve_path(".openclaw_test_exact/w");

    assert_eq!(response.path_type, PathType::Relative);

    assert!(response.candidates.iter().any(|c| c.name == "exact_w.md"));
    assert!(!response.candidates.iter().any(|c| c.name == "fuzzy_w.md"));
    assert!(!response.candidates.iter().any(|c| c.name == "normal_w.md"));

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_resolve_path_fuzzy_search() {
    let response = PathSearchService::resolve_path("test");
    assert_eq!(response.path_type, PathType::Fuzzy);
}

#[test]
fn test_resolve_path_empty_string() {
    let response = PathSearchService::resolve_path("");
    assert_eq!(response.path_type, PathType::Fuzzy);
}
