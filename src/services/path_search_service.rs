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
#[path = "path_search_service_test.rs"]
mod path_search_service_test;
