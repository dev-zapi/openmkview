use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
}

impl AppPaths {
    pub fn new() -> Self {
        let config_dir = std::env::var("OPENMKVIEW_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                dirs::config_dir()
                    .expect("Cannot get config directory")
                    .join("openmkview")
            });

        let data_dir = std::env::var("OPENMKVIEW_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                dirs::data_local_dir()
                    .expect("Cannot get data directory")
                    .join("openmkview")
            });

        Self {
            config_dir,
            data_dir,
        }
    }

    pub fn config_file(&self) -> PathBuf {
        self.config_dir.join("config.toml")
    }

    pub fn themes_dir(&self) -> PathBuf {
        self.config_dir.join("themes")
    }

    pub fn db_path(&self) -> PathBuf {
        self.data_dir.join("openmkview.db")
    }

    pub fn trash_dir(&self) -> PathBuf {
        self.data_dir.join("trash")
    }

    pub fn passkey_store_path(&self) -> PathBuf {
        self.data_dir.join("passkeys.json")
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.config_dir)?;
        std::fs::create_dir_all(&self.data_dir)?;
        std::fs::create_dir_all(self.themes_dir())?;
        std::fs::create_dir_all(self.trash_dir())?;
        Ok(())
    }
}

impl Default for AppPaths {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_config_file_path() {
        let temp_dir = TempDir::new().unwrap();
        let paths = AppPaths {
            config_dir: temp_dir.path().to_path_buf(),
            data_dir: temp_dir.path().to_path_buf(),
        };
        assert_eq!(paths.config_file(), temp_dir.path().join("config.toml"));
    }

    #[test]
    fn test_themes_dir_path() {
        let temp_dir = TempDir::new().unwrap();
        let paths = AppPaths {
            config_dir: temp_dir.path().to_path_buf(),
            data_dir: temp_dir.path().to_path_buf(),
        };
        assert_eq!(paths.themes_dir(), temp_dir.path().join("themes"));
    }

    #[test]
    fn test_db_path() {
        let temp_dir = TempDir::new().unwrap();
        let paths = AppPaths {
            config_dir: temp_dir.path().to_path_buf(),
            data_dir: temp_dir.path().to_path_buf(),
        };
        assert_eq!(paths.db_path(), temp_dir.path().join("openmkview.db"));
    }

    #[test]
    fn test_trash_dir_path() {
        let temp_dir = TempDir::new().unwrap();
        let paths = AppPaths {
            config_dir: temp_dir.path().to_path_buf(),
            data_dir: temp_dir.path().to_path_buf(),
        };
        assert_eq!(paths.trash_dir(), temp_dir.path().join("trash"));
    }

    #[test]
    fn test_passkey_store_path() {
        let temp_dir = TempDir::new().unwrap();
        let paths = AppPaths {
            config_dir: temp_dir.path().to_path_buf(),
            data_dir: temp_dir.path().to_path_buf(),
        };
        assert_eq!(
            paths.passkey_store_path(),
            temp_dir.path().join("passkeys.json")
        );
    }

    #[test]
    fn test_ensure_dirs_creates_directories() {
        let temp_dir = TempDir::new().unwrap();
        let paths = AppPaths {
            config_dir: temp_dir.path().join("config"),
            data_dir: temp_dir.path().join("data"),
        };

        paths.ensure_dirs().unwrap();

        assert!(paths.config_dir.exists());
        assert!(paths.data_dir.exists());
        assert!(paths.themes_dir().exists());
        assert!(paths.trash_dir().exists());
    }
}
