use crate::errors::AppResult;
use crate::models::{get_builtin_themes, Theme, ThemeListResponse, ThemeMetadata, ThemeType};
use regex::Regex;
use std::path::PathBuf;

fn get_themes_dir() -> PathBuf {
    let config_home = std::env::var("XDG_CONFIG_HOME")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".config")
        });
    let themes_dir = config_home.join("openmkview").join("themes");
    if !themes_dir.exists() {
        std::fs::create_dir_all(&themes_dir).ok();
    }
    themes_dir
}

fn parse_theme_metadata(css_content: &str) -> Option<ThemeMetadata> {
    let metadata_regex = Regex::new(r"/\*\s*\n?\s*\*?\s*@(\w+):\s*([^\n]+)").unwrap();

    let mut name: Option<String> = None;
    let mut theme_type: Option<ThemeType> = None;
    let mut description: Option<String> = None;
    let mut author: Option<String> = None;
    let mut version: Option<String> = None;

    for cap in metadata_regex.captures_iter(css_content) {
        let key = cap.get(1).unwrap().as_str();
        let value = cap.get(2).unwrap().as_str().trim();

        match key {
            "name" => name = Some(value.to_string()),
            "type" => {
                theme_type = match value {
                    "light" | "Light" => Some(ThemeType::Light),
                    "dark" | "Dark" => Some(ThemeType::Dark),
                    _ => None,
                };
            }
            "description" => description = Some(value.to_string()),
            "author" => author = Some(value.to_string()),
            "version" => version = Some(value.to_string()),
            _ => {}
        }
    }

    if let (Some(n), Some(t)) = (name, theme_type) {
        Some(ThemeMetadata {
            name: n,
            theme_type: t,
            description,
            author,
            version,
        })
    } else {
        None
    }
}

fn sanitize_theme_id(name: &str) -> String {
    let id = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();
    let id_regex = Regex::new(r"-+").unwrap();
    id_regex.replace_all(&id, "-").trim_matches('-').to_string()
}

pub fn get_all_themes() -> AppResult<ThemeListResponse> {
    let mut themes = get_builtin_themes();

    let themes_dir = get_themes_dir();
    if themes_dir.exists() {
        for entry in std::fs::read_dir(&themes_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().is_some_and(|ext| ext == "css") {
                let filename = path.file_name().unwrap().to_string_lossy().to_string();
                if filename.ends_with(".theme.css") {
                    let css_content = std::fs::read_to_string(&path)?;

                    if let Some(metadata) = parse_theme_metadata(&css_content) {
                        let id = sanitize_theme_id(&metadata.name);
                        let theme_type_str = match metadata.theme_type {
                            ThemeType::Light => "light",
                            ThemeType::Dark => "dark",
                        };

                        let full_id = format!("{}-{}", theme_type_str, id);

                        themes.push(Theme {
                            id: full_id,
                            name: metadata.name,
                            theme_type: metadata.theme_type,
                            description: metadata.description,
                            author: metadata.author,
                            version: metadata.version,
                            is_builtin: false,
                        });
                    }
                }
            }
        }
    }

    Ok(ThemeListResponse { themes })
}

pub fn get_theme_css(theme_id: &str) -> AppResult<String> {
    let builtin_themes = get_builtin_themes();
    if builtin_themes.iter().any(|t| t.id == theme_id) {
        return Err(crate::errors::AppError::BadRequest(
            "Built-in themes are embedded in the frontend CSS".to_string(),
        ));
    }

    let themes_dir = get_themes_dir();

    for entry in std::fs::read_dir(&themes_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().is_some_and(|ext| ext == "css") {
            let filename = path.file_name().unwrap().to_string_lossy().to_string();
            if filename.ends_with(".theme.css") {
                let css_content = std::fs::read_to_string(&path)?;

                if let Some(metadata) = parse_theme_metadata(&css_content) {
                    let id = sanitize_theme_id(&metadata.name);
                    let theme_type_str = match metadata.theme_type {
                        ThemeType::Light => "light",
                        ThemeType::Dark => "dark",
                    };

                    let full_id = format!("{}-{}", theme_type_str, id);

                    if full_id == theme_id {
                        return Ok(css_content);
                    }
                }
            }
        }
    }

    Err(crate::errors::AppError::NotFound(format!(
        "Theme '{}' not found",
        theme_id
    )))
}

pub fn install_theme(_filename: &str, content: &str) -> AppResult<Theme> {
    let metadata = parse_theme_metadata(content).ok_or_else(|| {
        crate::errors::AppError::BadRequest(
            "Invalid theme file: missing @name or @type metadata".to_string(),
        )
    })?;

    let id = sanitize_theme_id(&metadata.name);
    let theme_type_str = match metadata.theme_type {
        ThemeType::Light => "light",
        ThemeType::Dark => "dark",
    };

    let full_id = format!("{}-{}", theme_type_str, id);

    let themes_dir = get_themes_dir();
    let file_path = themes_dir.join(format!("{}.theme.css", id));

    std::fs::write(&file_path, content)?;

    Ok(Theme {
        id: full_id,
        name: metadata.name,
        theme_type: metadata.theme_type,
        description: metadata.description,
        author: metadata.author,
        version: metadata.version,
        is_builtin: false,
    })
}

pub fn delete_theme(theme_id: &str) -> AppResult<()> {
    let builtin_themes = get_builtin_themes();
    if builtin_themes.iter().any(|t| t.id == theme_id) {
        return Err(crate::errors::AppError::BadRequest(
            "Cannot delete built-in themes".to_string(),
        ));
    }

    let themes_dir = get_themes_dir();

    for entry in std::fs::read_dir(&themes_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().is_some_and(|ext| ext == "css") {
            let filename = path.file_name().unwrap().to_string_lossy().to_string();
            if filename.ends_with(".theme.css") {
                let css_content = std::fs::read_to_string(&path)?;

                if let Some(metadata) = parse_theme_metadata(&css_content) {
                    let id = sanitize_theme_id(&metadata.name);
                    let theme_type_str = match metadata.theme_type {
                        ThemeType::Light => "light",
                        ThemeType::Dark => "dark",
                    };

                    let full_id = format!("{}-{}", theme_type_str, id);

                    if full_id == theme_id {
                        std::fs::remove_file(&path)?;
                        return Ok(());
                    }
                }
            }
        }
    }

    Err(crate::errors::AppError::NotFound(format!(
        "Theme '{}' not found",
        theme_id
    )))
}
