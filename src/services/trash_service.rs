use crate::errors::AppResult;
use crate::models::{TrashItem, TrashMetadata, TrashStats};
use chrono::{DateTime, Utc};
use std::fs;
use std::path::{Path, PathBuf};

fn get_trash_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openmkview")
        .join("trash")
}

fn get_project_trash_dir(project_id: i64) -> PathBuf {
    get_trash_dir().join(project_id.to_string())
}

fn get_size(path: &PathBuf) -> AppResult<u64> {
    if path.is_dir() {
        let mut total_size = 0;
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let entry_path = entry.path();
            total_size += get_size(&entry_path)?;
        }
        Ok(total_size)
    } else {
        Ok(fs::metadata(path)?.len())
    }
}

pub struct TrashService;

impl TrashService {
    pub fn move_to_trash(
        project_path: &Path,
        file_path: &str,
        is_folder: bool,
        project_id: i64,
    ) -> AppResult<TrashItem> {
        let trash_dir = get_project_trash_dir(project_id);
        let files_dir = trash_dir.join("files");
        let metadata_dir = trash_dir.join("metadata");

        fs::create_dir_all(&files_dir)?;
        fs::create_dir_all(&metadata_dir)?;

        let timestamp = Utc::now().timestamp();
        let path_obj = PathBuf::from(file_path);
        let original_name = path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        let trash_name = format!("{}_{}", timestamp, original_name);

        let source = project_path.join(file_path);
        let dest = files_dir.join(&trash_name);

        if !source.exists() {
            return Err(crate::errors::AppError::NotFound(format!(
                "File not found: {}",
                file_path
            )));
        }

        fs::rename(&source, &dest)?;

        let size = get_size(&dest)?;
        let deleted_at = Utc::now().to_rfc3339();

        let metadata = TrashMetadata {
            original_path: file_path.to_string(),
            original_name: original_name.to_string(),
            project_id,
            deleted_at: deleted_at.clone(),
            is_folder,
            size,
        };

        let meta_path = metadata_dir.join(format!("{}.meta", trash_name));
        fs::write(&meta_path, serde_json::to_string(&metadata)?)?;

        Ok(TrashItem {
            id: trash_name,
            original_name: original_name.to_string(),
            original_path: file_path.to_string(),
            deleted_at,
            is_folder,
            size,
        })
    }

    pub fn restore_from_trash(
        project_path: &Path,
        trash_item_id: &str,
        project_id: i64,
    ) -> AppResult<()> {
        let trash_dir = get_project_trash_dir(project_id);
        let source = trash_dir.join("files").join(trash_item_id);
        let meta_path = trash_dir
            .join("metadata")
            .join(format!("{}.meta", trash_item_id));

        if !source.exists() || !meta_path.exists() {
            return Err(crate::errors::AppError::NotFound(format!(
                "Trash item not found: {}",
                trash_item_id
            )));
        }

        let metadata_content = fs::read_to_string(&meta_path)?;
        let metadata: TrashMetadata = serde_json::from_str(&metadata_content)?;

        let dest = project_path.join(&metadata.original_path);

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(&source, &dest)?;
        fs::remove_file(&meta_path)?;

        Ok(())
    }

    pub fn delete_from_trash(project_id: i64, trash_item_id: &str) -> AppResult<()> {
        let trash_dir = get_project_trash_dir(project_id);
        let file_path = trash_dir.join("files").join(trash_item_id);
        let meta_path = trash_dir
            .join("metadata")
            .join(format!("{}.meta", trash_item_id));

        if file_path.is_dir() {
            fs::remove_dir_all(&file_path)?;
        } else if file_path.exists() {
            fs::remove_file(&file_path)?;
        }

        if meta_path.exists() {
            fs::remove_file(&meta_path)?;
        }

        Ok(())
    }

    pub fn clear_trash(project_id: i64) -> AppResult<()> {
        let trash_dir = get_project_trash_dir(project_id);
        if trash_dir.exists() {
            fs::remove_dir_all(&trash_dir)?;
        }
        Ok(())
    }

    pub fn list_trash(project_id: i64) -> AppResult<Vec<TrashItem>> {
        let trash_dir = get_project_trash_dir(project_id);
        let metadata_dir = trash_dir.join("metadata");

        if !metadata_dir.exists() {
            return Ok(vec![]);
        }

        let mut items = Vec::new();
        for entry in fs::read_dir(&metadata_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map(|e| e == "meta").unwrap_or(false) {
                let content = fs::read_to_string(&path)?;
                if let Ok(metadata) = serde_json::from_str::<TrashMetadata>(&content) {
                    let trash_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .replace(".meta", "");

                    items.push(TrashItem {
                        id: trash_name,
                        original_name: metadata.original_name,
                        original_path: metadata.original_path,
                        deleted_at: metadata.deleted_at,
                        is_folder: metadata.is_folder,
                        size: metadata.size,
                    });
                }
            }
        }

        items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));

        Ok(items)
    }

    pub fn get_trash_stats(project_id: i64) -> AppResult<TrashStats> {
        let items = Self::list_trash(project_id)?;
        let total_items = items.len();
        let total_size = items.iter().map(|i| i.size).sum();

        let oldest_item_age =
            if let Some(oldest) = items.iter().min_by(|a, b| a.deleted_at.cmp(&b.deleted_at)) {
                if let Ok(deleted_at) = DateTime::parse_from_rfc3339(&oldest.deleted_at) {
                    let deleted_at_utc = deleted_at.with_timezone(&Utc);
                    let now = Utc::now();
                    (now - deleted_at_utc).num_days() as u32
                } else {
                    0
                }
            } else {
                0
            };

        Ok(TrashStats {
            total_items,
            total_size,
            oldest_item_age,
        })
    }

    pub fn cleanup_expired_trash(project_id: i64, expire_days: u32) -> AppResult<usize> {
        let items = Self::list_trash(project_id)?;
        let now = Utc::now();
        let mut deleted_count = 0;

        for item in items {
            if let Ok(deleted_at) = DateTime::parse_from_rfc3339(&item.deleted_at) {
                let deleted_at_utc = deleted_at.with_timezone(&Utc);
                let days_since = (now - deleted_at_utc).num_days() as u32;

                if days_since >= expire_days {
                    Self::delete_from_trash(project_id, &item.id)?;
                    deleted_count += 1;
                }
            }
        }

        Ok(deleted_count)
    }

    pub fn cleanup_all_expired_trash(expire_days: u32, project_ids: &[i64]) -> AppResult<usize> {
        let mut total_deleted = 0;
        for project_id in project_ids {
            if let Ok(count) = Self::cleanup_expired_trash(*project_id, expire_days) {
                total_deleted += count;
            }
        }
        Ok(total_deleted)
    }

    pub fn is_protected_path(path: &str, protected_paths: &[String]) -> bool {
        let path_lower = path.to_lowercase();
        for protected in protected_paths {
            if path_lower.contains(&protected.to_lowercase()) {
                return true;
            }
        }
        false
    }
}
