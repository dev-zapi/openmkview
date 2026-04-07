use crate::models::{PathCandidate, PathType, ResolvePathResponse};
use log::debug;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

fn search_with_depth(
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

    let walker = WalkDir::new(base_path)
        .max_depth(max_depth as usize)
        .into_iter()
        .filter_entry(|e| include_hidden || !is_hidden(e));

    for entry in walker.filter_map(|e| e.ok()) {
        if let Some(file_name) = entry.file_name().to_str() {
            let file_name_lower = file_name.to_lowercase();
            if file_name_lower.contains(&target_lower) {
                let full_path = entry.path();
                if let Ok(relative) = full_path.strip_prefix(base_path) {
                    let relative_path = relative.to_string_lossy().to_string();
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

fn extract_path_and_term(input: &str) -> (Option<PathBuf>, String) {
    let path = Path::new(input);

    if let Some(parent) = path.parent() {
        if parent.as_os_str().is_empty() {
            return (None, input.to_string());
        }

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

pub struct PathSearchService;

impl PathSearchService {
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
            let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let (base_path, search_term) = extract_path_and_term(path_input);
            if let Some(base) = base_path {
                debug!(
                    "[resolve_path] Relative path search: base={}, term={}",
                    base.display(),
                    search_term
                );

                if base.exists() {
                    let search_results = search_with_depth(&base, &search_term, 2, true);
                    debug!(
                        "[resolve_path] Relative path search returned {} candidates",
                        search_results.len()
                    );
                    (PathType::Relative, search_results)
                } else {
                    debug!(
                        "[resolve_path] Base path '{}' does not exist, searching for matching directories",
                        base.display()
                    );

                    let base_name = base.file_name().and_then(|n| n.to_str()).unwrap_or("");

                    if base_name.is_empty() {
                        (PathType::Relative, vec![])
                    } else {
                        let mut all_candidates = Vec::new();
                        let base_lower = base_name.to_lowercase();

                        let walker = WalkDir::new(&current_dir)
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
                            "[resolve_path] Fuzzy directory search returned {} candidates",
                            all_candidates.len()
                        );
                        (PathType::Relative, all_candidates)
                    }
                }
            } else {
                (PathType::Relative, vec![])
            }
        } else {
            let home_path = dirs::home_dir()
                .unwrap_or_else(|| std::env::current_dir().expect("Cannot get current directory"));
            debug!(
                "[resolve_path] Path type: Fuzzy, search directory: {}",
                home_path.display()
            );
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
