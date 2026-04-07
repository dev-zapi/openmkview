//! Path Search Service
//!
//! This service handles intelligent path resolution for user input, supporting three types of searches:
//! - **Absolute paths**: `/home/user/projects/myapp/src` - exact path resolution
//! - **Relative paths**: `src/main`, `.hidden/config` - relative to home directory or fuzzy directory search
//! - **Fuzzy search**: `myproject` - search from home directory with pattern matching
//!
//! ## Path Resolution Logic
//!
//! 1. **Absolute Path** (`starts_with('/')`)
//!    - Extract base directory and search term from the path
//!    - If base exists, search within it
//!    - If base doesn't exist, return empty results
//!
//! 2. **Relative Path** (`contains('/')`)
//!    - Two scenarios:
//!      a) Base directory exists (e.g., `src/main` where `src` exists) → direct search
//!      b) Base directory doesn't exist (e.g., `.openclaw/w` where `.openclaw` doesn't exist)
//!         - search all directories with matching name from home directory tree
//!
//! 3. **Fuzzy Search** (no `/`)
//!    - Search from home directory with pattern matching
//!    - Excludes hidden files by default

use crate::models::{PathCandidate, PathType, ResolvePathResponse};
use log::debug;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

/// Check if a directory entry is a hidden file/directory
///
/// Hidden files are those whose names start with a dot (`.`)
/// Example: `.git`, `.env`, `.hidden_folder`
///
/// # Arguments
/// * `entry` - Directory entry to check
///
/// # Returns
/// * `true` if the entry name starts with `.`
/// * `false` otherwise (or if name cannot be converted to string)
pub(crate) fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

/// Search for files/directories matching a pattern within a base path
///
/// This function performs a recursive search up to a specified depth,
/// returning all entries whose names contain the search term (case-insensitive).
///
/// # Arguments
/// * `base_path` - Directory to search within
/// * `target` - Search pattern (case-insensitive substring match)
/// * `max_depth` - Maximum recursion depth (1 = immediate children only)
/// * `include_hidden` - Whether to include hidden files/directories (those starting with `.`)
///
/// # Returns
/// Vector of `PathCandidate` containing:
/// * `name` - File/directory name
/// * `path` - Full absolute/relative path
/// * `depth` - Depth from base path (0 = base itself, 1 = immediate children, etc.)
/// * `relative_path` - Path relative to base directory
///
/// # Examples
/// ```ignore
/// // Search for "main" in "src" directory, depth 2, including hidden files
/// search_with_depth(Path::new("src"), "main", 2, true)
/// // Returns: files like main.rs, main.c, etc. within src/ and src/subdirs/
/// ```
pub(crate) fn search_with_depth(
    base_path: &Path,
    target: &str,
    max_depth: i32,
    include_hidden: bool,
) -> Vec<PathCandidate> {
    debug!(
        "[path_search] Searching path: target={}, base={}, max_depth={}, include_hidden={}",
        target,
        base_path.display(),
        max_depth,
        include_hidden
    );
    let mut candidates = Vec::new();
    let target_lower = target.to_lowercase();

    // Create walker with depth limit and optional hidden file filtering
    let walker = WalkDir::new(base_path)
        .max_depth(max_depth as usize)
        .into_iter()
        .filter_entry(|e| include_hidden || !is_hidden(e));

    // Iterate through all valid entries
    for entry in walker.filter_map(|e| e.ok()) {
        if let Some(file_name) = entry.file_name().to_str() {
            let file_name_lower = file_name.to_lowercase();
            // Case-insensitive substring match
            if file_name_lower.contains(&target_lower) {
                let full_path = entry.path();
                // Calculate relative path from base
                if let Ok(relative) = full_path.strip_prefix(base_path) {
                    let relative_path = relative.to_string_lossy().to_string();
                    // Depth = number of path components from base
                    let depth = relative.components().count() as i32;

                    candidates.push(PathCandidate {
                        name: file_name.to_string(),
                        path: full_path.to_string_lossy().to_string(),
                        depth,
                        relative_path: if relative_path.is_empty() {
                            file_name.to_string()
                        } else {
                            relative_path
                        },
                    });
                }
            }
        }
    }

    debug!(
        "[path_search] Search complete: found {} candidates",
        candidates.len()
    );
    candidates
}

/// Extract base directory and search term from a path string
///
/// This function splits a path into two parts:
/// 1. The parent directory (base) where the search should be performed
/// 2. The last component (term) which is the search pattern
///
/// # Arguments
/// * `input` - Path string to parse
///
/// # Returns
/// Tuple of (Option<PathBuf>, String):
/// * First element: Base directory path (None if input has no parent)
/// * Second element: Search term (last component of the path)
///
/// # Examples
/// ```ignore
/// extract_path_and_term("/home/user/src/main")
/// // Returns: (Some(PathBuf::from("/home/user/src")), "main")
///
/// extract_path_and_term("src/main")
/// // Returns: (Some(PathBuf::from("src")), "main")
///
/// extract_path_and_term(".openclaw/w")
/// // Returns: (Some(PathBuf::from(".openclaw")), "w")
///
/// extract_path_and_term(".openclaw/")
/// // Returns: (Some(PathBuf::from(".openclaw")), "")  // Empty search term for trailing slash
///
/// extract_path_and_term("filename")
/// // Returns: (None, "filename")  // No parent directory
/// ```
pub(crate) fn extract_path_and_term(input: &str) -> (Option<PathBuf>, String) {
    let trimmed = input.trim_end_matches('/');
    let path = Path::new(trimmed);

    // If input ends with '/', treat it as directory search (empty search term)
    if input.ends_with('/') && !trimmed.is_empty() {
        return (Some(PathBuf::from(trimmed)), String::new());
    }

    if let Some(parent) = path.parent() {
        // Edge case: path like "filename" has empty parent
        if parent.as_os_str().is_empty() {
            return (None, input.to_string());
        }

        // Extract the last component as search term
        let term = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        (Some(parent.to_path_buf()), term)
    } else {
        (None, input.to_string())
    }
}

/// Path search service for intelligent path resolution
///
/// This service provides the main entry point for resolving user-provided path strings
/// into concrete file/directory candidates.
pub struct PathSearchService;

impl PathSearchService {
    /// Resolve a path string into matching file/directory candidates
    ///
    /// This is the main entry point for path resolution. It handles three types of input:
    ///
    /// ## Absolute Paths
    /// Input starts with `/` (e.g., `/home/user/projects/src`)
    /// - Extract base directory and search term
    /// - If base exists, search within it (max depth 2, include hidden)
    /// - If base doesn't exist, return empty results
    ///
    /// ## Relative Paths
    /// Input contains `/` but doesn't start with `/` (e.g., `src/main`, `.hidden/file`)
    /// - **If base exists**: Direct search within base directory
    /// - **If base doesn't exist**: Fuzzy directory search
    ///   - Search home directory tree for directories matching the base name
    ///   - For each matching directory, search within it
    ///   - Uses exact match for directory name (not substring)
    ///   - Example: `.openclaw/w` searches all directories named `.openclaw`
    ///
    /// ## Fuzzy Search
    /// Input has no `/` (e.g., `myproject`)
    /// - Search from home directory
    /// - Case-insensitive substring match
    /// - Excludes hidden files by default
    ///
    /// # Arguments
    /// * `path_input` - User-provided path string
    ///
    /// # Returns
    /// `ResolvePathResponse` containing:
    /// * `path_type` - Type of path resolution performed (Absolute, Relative, or Fuzzy)
    /// * `candidates` - List of matching files/directories
    ///
    /// # Examples
    /// ```ignore
    /// // Absolute path with existing directory
    /// resolve_path("/home/user/projects/src/main")
    /// // Returns candidates from /home/user/projects/src matching "main"
    ///
    /// // Relative path with existing base
    /// resolve_path("src/main")
    /// // Returns candidates from ./src matching "main"
    ///
    /// // Relative path with non-existing base (fuzzy directory search)
    /// resolve_path(".openclaw/w")
    /// // Searches all directories named .openclaw, returns files matching "w"
    ///
    /// // Directory search with trailing slash
    /// resolve_path(".openclaw/")
    /// // Returns all items in .openclaw directory (empty search term matches all)
    ///
    /// // Fuzzy search
    /// resolve_path("myproject")
    /// // Returns candidates from home directory matching "myproject"
    /// ```
    pub fn resolve_path(path_input: &str) -> ResolvePathResponse {
        debug!("[resolve_path] Parsing path input: {}", path_input);

        let (path_type, candidates) = if path_input.starts_with('/') {
            debug!("[resolve_path] Path type: Absolute");
            let (base_path, search_term) = extract_path_and_term(path_input);
            if let Some(base) = base_path {
                debug!(
                    "[resolve_path] Absolute path search: base={}, term={}",
                    base.display(),
                    search_term
                );
                if base.exists() {
                    let search_results = search_with_depth(&base, &search_term, 2, true);
                    debug!(
                        "[resolve_path] Absolute path search returned {} candidates",
                        search_results.len()
                    );
                    (PathType::Absolute, search_results)
                } else {
                    debug!(
                        "[resolve_path] Absolute base path does not exist: {}",
                        base.display()
                    );
                    (PathType::Absolute, vec![])
                }
            } else {
                (PathType::Absolute, vec![])
            }
        } else if path_input.contains('/') {
            debug!("[resolve_path] Path type: Relative");
            let (base_path, search_term) = extract_path_and_term(path_input);
            if let Some(base) = base_path {
                debug!(
                    "[resolve_path] Relative path search: base={}, term={}",
                    base.display(),
                    search_term
                );

                // Relative paths always search from HOME directory
                // Extract the directory name to search for (last component of base path)
                // Example: base=".openclaw" → base_name=".openclaw"
                // Example: base="src/projects" → base_name="projects"
                let base_name = base.file_name().and_then(|n| n.to_str()).unwrap_or("");

                if base_name.is_empty() {
                    (PathType::Relative, vec![])
                } else {
                    let home_dir = dirs::home_dir().expect("Cannot get home directory");

                    debug!(
                        "[resolve_path] Searching from home directory: {}",
                        home_dir.display()
                    );

                    let mut all_candidates = Vec::new();
                    let base_lower = base_name.to_lowercase();

                    let walker = WalkDir::new(&home_dir)
                        .max_depth(3)
                        .into_iter()
                        .filter_entry(|_| true);

                    for entry in walker.filter_map(|e| e.ok()) {
                        if let Some(file_name) = entry.file_name().to_str() {
                            let file_name_lower = file_name.to_lowercase();
                            if file_name_lower == base_lower && entry.path().is_dir() {
                                debug!(
                                    "[resolve_path] Found matching directory: {}",
                                    entry.path().display()
                                );
                                let sub_results =
                                    search_with_depth(entry.path(), &search_term, 2, true);
                                all_candidates.extend(sub_results);
                            }
                        }
                    }

                    debug!(
                        "[resolve_path] Relative path search returned {} candidates",
                        all_candidates.len()
                    );
                    (PathType::Relative, all_candidates)
                }
            } else {
                (PathType::Relative, vec![])
            }
        } else {
            // Case: No `/` in input - fuzzy search from home directory
            // This handles simple search patterns like "myproject", "work", etc.
            let home_path = dirs::home_dir().expect("Cannot get home directory");
            debug!(
                "[resolve_path] Path type: Fuzzy, search directory: {}",
                home_path.display()
            );
            // Search with hidden files excluded (include_hidden=false)
            // User can use relative path syntax (.hidden/...) to explicitly search hidden directories
            let search_results = search_with_depth(&home_path, path_input, 2, false);
            debug!(
                "[resolve_path] Fuzzy search returned {} candidates",
                search_results.len()
            );
            (PathType::Fuzzy, search_results)
        };

        debug!(
            "[resolve_path] Parse complete: path_type={:?}, candidates_count={}",
            path_type,
            candidates.len()
        );

        ResolvePathResponse {
            path_type,
            candidates,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::TempDir;

    // ==================== is_hidden tests ====================

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

    // ==================== extract_path_and_term tests ====================

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
        // "/" has parent that is empty, so returns (None, "/")
        // file_name for "/" returns "/" itself
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
        // Path ending with "/" should treat directory as base with empty search term
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

    // ==================== search_with_depth tests ====================

    // Note: TempDir creates hidden directories (e.g., /tmp/.tmpXXX)
    // so we must use include_hidden=true to search within them
    #[test]
    fn test_search_with_depth_basic() {
        let temp_dir = TempDir::new().unwrap();
        let file1 = temp_dir.path().join("main.rs");
        let file2 = temp_dir.path().join("test.rs");
        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        let candidates = search_with_depth(temp_dir.path(), "main", 1, true);

        assert!(candidates.len() >= 1);
        assert!(candidates.iter().any(|c| c.name == "main.rs"));
        let main_candidate = candidates.iter().find(|c| c.name == "main.rs");
        assert!(main_candidate.is_some());
        assert_eq!(main_candidate.unwrap().depth, 1);
    }

    // Note: TempDir creates hidden directories, use include_hidden=true
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

    // Note: TempDir creates hidden directories, use include_hidden=true
    #[test]
    fn test_search_with_depth_case_insensitive() {
        let temp_dir = TempDir::new().unwrap();
        let file = temp_dir.path().join("Main.rs");
        File::create(&file).unwrap();

        let candidates = search_with_depth(temp_dir.path(), "main", 1, true);

        assert!(candidates.len() >= 1);
        assert!(candidates.iter().any(|c| c.name == "Main.rs"));
    }

    #[test]
    fn test_search_with_depth_hidden_files_excluded() {
        // Create a non-hidden base directory to test hidden file filtering
        let temp_base = TempDir::new().unwrap();
        let normal_dir = temp_base.path().join("normaldir"); // Non-hidden directory
        fs::create_dir(&normal_dir).unwrap();

        let hidden_file = normal_dir.join(".hidden.txt");
        let normal_file = normal_dir.join("normal.txt");
        File::create(&hidden_file).unwrap();
        File::create(&normal_file).unwrap();

        // Search with hidden files excluded (include_hidden=false)
        let candidates = search_with_depth(&normal_dir, "hidden", 1, false);

        // Hidden files excluded, should find nothing
        assert_eq!(candidates.len(), 0);
    }

    #[test]
    fn test_search_with_depth_hidden_files_included() {
        // Create a non-hidden base directory to properly test hidden file inclusion
        let temp_base = TempDir::new().unwrap();
        let normal_dir = temp_base.path().join("normaldir");
        fs::create_dir(&normal_dir).unwrap();

        let hidden_file = normal_dir.join(".hidden.txt");
        let normal_file = normal_dir.join("normal.txt");
        File::create(&hidden_file).unwrap();
        File::create(&normal_file).unwrap();

        let candidates = search_with_depth(&normal_dir, "hidden", 1, true);

        // Hidden files included, should find .hidden.txt
        assert!(candidates.len() >= 1);
        assert!(candidates.iter().any(|c| c.name == ".hidden.txt"));
    }

    // Note: TempDir creates hidden directories, use include_hidden=true
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

    // Note: TempDir creates hidden directories, use include_hidden=true
    #[test]
    fn test_search_with_depth_relative_path() {
        let temp_dir = TempDir::new().unwrap();
        let file = temp_dir.path().join("test_file.txt");
        File::create(&file).unwrap();

        let candidates = search_with_depth(temp_dir.path(), "test_file", 1, true);

        assert!(candidates.len() >= 1);
        let test_candidate = candidates.iter().find(|c| c.name == "test_file.txt");
        assert!(test_candidate.is_some());
        assert_eq!(test_candidate.unwrap().relative_path, "test_file.txt");
    }

    // ==================== resolve_path tests ====================

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
        // Create test directory in HOME
        let home_dir = dirs::home_dir().expect("Cannot get home directory");
        let test_dir_name = ".test_openmkview_relative_existing";
        let test_dir = home_dir.join(test_dir_name);

        // Clean up first if exists
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

        // Cleanup
        fs::remove_dir_all(&test_dir).unwrap();
    }

    #[test]
    fn test_resolve_path_relative_hidden_directory() {
        // Create test directory in HOME
        let home_dir = dirs::home_dir().expect("Cannot get home directory");
        let test_dir_name = ".test_openmkview_hidden";
        let test_dir = home_dir.join(test_dir_name);

        // Clean up first if exists
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

        // Cleanup
        fs::remove_dir_all(&test_dir).unwrap();
    }

    #[test]
    fn test_resolve_path_relative_non_existing_base_fuzzy_search() {
        // Create test directory in HOME
        let home_dir = dirs::home_dir().expect("Cannot get home directory");
        let test_dir_name = ".test_openmkview_fuzzy_search";
        let test_dir = home_dir.join(test_dir_name);

        // Clean up first if exists
        if test_dir.exists() {
            fs::remove_dir_all(&test_dir).unwrap();
        }
        fs::create_dir_all(&test_dir).unwrap();

        // Create openclaw directory in test_dir
        let openclaw = test_dir.join("openclaw_test");
        fs::create_dir(&openclaw).unwrap();

        // Add file containing "w"
        let file = openclaw.join("worker.md");
        File::create(&file).unwrap();

        let response = PathSearchService::resolve_path("openclaw_test/w");
        assert_eq!(response.path_type, PathType::Relative);
        assert!(response.candidates.iter().any(|c| c.name == "worker.md"));

        // Cleanup
        fs::remove_dir_all(&test_dir).unwrap();
    }

    #[test]
    fn test_resolve_path_exact_directory_match() {
        // Create test directory in HOME
        let home_dir = dirs::home_dir().expect("Cannot get home directory");
        let test_dir_name = ".test_openmkview_exact_match";
        let test_dir = home_dir.join(test_dir_name);

        // Clean up first if exists
        if test_dir.exists() {
            fs::remove_dir_all(&test_dir).unwrap();
        }
        fs::create_dir_all(&test_dir).unwrap();

        // Create directories: .openclaw_test_exact, xxx.openclaw_test_exact, openclaw_test_exact
        let exact = test_dir.join(".openclaw_test_exact");
        let fuzzy = test_dir.join("xxx.openclaw_test_exact");
        let normal = test_dir.join("openclaw_test_exact");
        fs::create_dir(&exact).unwrap();
        fs::create_dir(&fuzzy).unwrap();
        fs::create_dir(&normal).unwrap();

        // Add files to each (names contain "w" to match search term)
        File::create(exact.join("exact_w.md")).unwrap();
        File::create(fuzzy.join("fuzzy_w.md")).unwrap();
        File::create(normal.join("normal_w.md")).unwrap();

        // Search for ".openclaw_test_exact/w" - should ONLY match .openclaw_test_exact (exact), not xxx.openclaw_test_exact
        let response = PathSearchService::resolve_path(".openclaw_test_exact/w");

        assert_eq!(response.path_type, PathType::Relative);
        println!("Candidates: {:?}", response.candidates);

        // Should find exact_w.md
        assert!(response.candidates.iter().any(|c| c.name == "exact_w.md"));
        // Should NOT find fuzzy_w.md or normal_w.md (wrong directory names)
        assert!(!response.candidates.iter().any(|c| c.name == "fuzzy_w.md"));
        assert!(!response.candidates.iter().any(|c| c.name == "normal_w.md"));

        // Cleanup
        fs::remove_dir_all(&test_dir).unwrap();
    }

    #[test]
    fn test_resolve_path_fuzzy_search() {
        // Fuzzy search from home directory
        // This test just verifies the path type is correct
        // Actual search results depend on user's home directory contents
        let response = PathSearchService::resolve_path("test");

        assert_eq!(response.path_type, PathType::Fuzzy);
    }

    #[test]
    fn test_resolve_path_empty_string() {
        let response = PathSearchService::resolve_path("");

        assert_eq!(response.path_type, PathType::Fuzzy);
    }
}
