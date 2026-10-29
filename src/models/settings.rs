use serde::{Deserialize, Serialize};

fn default_protected_paths() -> Vec<String> {
    vec![
        ".git".to_string(),
        ".github".to_string(),
        ".svn".to_string(),
        ".hg".to_string(),
        "node_modules".to_string(),
        "target".to_string(),
        "dist".to_string(),
        "build".to_string(),
    ]
}

fn default_placeholder_dirs() -> Vec<String> {
    vec![
        "node_modules".to_string(),
        "target".to_string(),
        "dist".to_string(),
        "build".to_string(),
        ".git".to_string(),
        ".svn".to_string(),
        ".hg".to_string(),
    ]
}

fn default_ignored_files() -> Vec<String> {
    vec![".DS_Store".to_string(), "Thumbs.db".to_string()]
}

fn default_trash_expire_days() -> u32 {
    30
}

fn default_session_timeout_minutes() -> u64 {
    60
}

fn default_ui_font_family() -> String {
    "MiSans, sans-serif".to_string()
}

fn default_markdown_font_family() -> String {
    "Georgia, \"Noto Serif\", serif".to_string()
}

fn default_code_font_family() -> String {
    "\"JetBrains Mono\", ui-monospace, Consolas, monospace".to_string()
}

fn default_font_size() -> String {
    "14px".to_string()
}

fn default_markdown_font_size() -> String {
    "16px".to_string()
}

fn default_code_theme_light() -> String {
    "github-light".to_string()
}

fn default_code_theme_dark() -> String {
    "github-dark".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSettings {
    #[serde(rename = "markdownWidth", default)]
    pub markdown_width: WidthSetting,
    #[serde(rename = "uiFontFamily", default = "default_ui_font_family")]
    pub ui_font_family: String,
    #[serde(rename = "uiFontSize", default = "default_font_size")]
    pub ui_font_size: String,
    #[serde(
        rename = "markdownFontFamily",
        default = "default_markdown_font_family"
    )]
    pub markdown_font_family: String,
    #[serde(rename = "markdownFontSize", default = "default_markdown_font_size")]
    pub markdown_font_size: String,
    #[serde(rename = "codeFontFamily", default = "default_code_font_family")]
    pub code_font_family: String,
    #[serde(rename = "codeFontSize", default = "default_font_size")]
    pub code_font_size: String,
    #[serde(rename = "codeBlockThemeLight", default = "default_code_theme_light")]
    pub code_block_theme_light: String,
    #[serde(rename = "codeBlockThemeDark", default = "default_code_theme_dark")]
    pub code_block_theme_dark: String,
    #[serde(rename = "protectedPaths", default = "default_protected_paths")]
    pub protected_paths: Vec<String>,
    #[serde(rename = "trashExpireDays", default = "default_trash_expire_days")]
    pub trash_expire_days: u32,
    #[serde(
        rename = "sessionTimeoutMinutes",
        default = "default_session_timeout_minutes"
    )]
    pub session_timeout_minutes: u64,
    #[serde(rename = "tableDensity", default)]
    pub table_density: TableDensity,
    #[serde(rename = "customStylesheet", default)]
    pub custom_stylesheet: String,
    #[serde(rename = "tableWrap", default)]
    pub table_wrap: TableWrap,
    #[serde(rename = "placeholderDirs", default = "default_placeholder_dirs")]
    pub placeholder_dirs: Vec<String>,
    #[serde(rename = "ignoredFiles", default = "default_ignored_files")]
    pub ignored_files: Vec<String>,
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            markdown_width: WidthSetting::default(),
            ui_font_family: default_ui_font_family(),
            ui_font_size: default_font_size(),
            markdown_font_family: default_markdown_font_family(),
            markdown_font_size: default_markdown_font_size(),
            code_font_family: default_code_font_family(),
            code_font_size: default_font_size(),
            code_block_theme_light: default_code_theme_light(),
            code_block_theme_dark: default_code_theme_dark(),
            protected_paths: default_protected_paths(),
            trash_expire_days: default_trash_expire_days(),
            session_timeout_minutes: default_session_timeout_minutes(),
            table_density: TableDensity::default(),
            custom_stylesheet: String::new(),
            table_wrap: TableWrap::default(),
            placeholder_dirs: default_placeholder_dirs(),
            ignored_files: default_ignored_files(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidthSetting {
    #[serde(default)]
    pub mode: WidthMode,
    #[serde(rename = "fixedWidth", default = "default_width")]
    pub fixed_width: String,
}

impl Default for WidthSetting {
    fn default() -> Self {
        Self {
            mode: WidthMode::default(),
            fixed_width: default_width(),
        }
    }
}

fn default_width() -> String {
    "70%".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WidthMode {
    #[default]
    Full,
    Fixed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TableDensity {
    Small,
    #[default]
    Medium,
    Large,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TableWrap {
    #[default]
    Wrap,
    Nowrap,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_table_density_is_medium() {
        assert_eq!(
            SystemSettings::default().table_density,
            TableDensity::Medium
        );
    }

    #[test]
    fn default_custom_stylesheet_is_empty() {
        assert_eq!(SystemSettings::default().custom_stylesheet, "");
    }

    #[test]
    fn empty_json_yields_defaults_for_new_fields() {
        let settings: SystemSettings = serde_json::from_str("{}").unwrap();
        assert_eq!(settings.table_density, TableDensity::Medium);
        assert_eq!(settings.custom_stylesheet, "");
    }

    #[test]
    fn table_density_deserializes_from_lowercase() {
        let json = r#"{"tableDensity":"small"}"#;
        let settings: SystemSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.table_density, TableDensity::Small);

        let json = r#"{"tableDensity":"large"}"#;
        let settings: SystemSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.table_density, TableDensity::Large);
    }

    #[test]
    fn custom_stylesheet_round_trips() {
        let json = r#"{"customStylesheet":"table { color: red }"}"#;
        let settings: SystemSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.custom_stylesheet, "table { color: red }");
    }

    #[test]
    fn default_table_wrap_is_wrap() {
        assert_eq!(SystemSettings::default().table_wrap, TableWrap::Wrap);
    }

    #[test]
    fn empty_json_yields_default_table_wrap() {
        let settings: SystemSettings = serde_json::from_str("{}").unwrap();
        assert_eq!(settings.table_wrap, TableWrap::Wrap);
    }

    #[test]
    fn table_wrap_deserializes_from_lowercase() {
        let json = r#"{"tableWrap":"nowrap"}"#;
        let settings: SystemSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.table_wrap, TableWrap::Nowrap);
    }

    #[test]
    fn placeholder_dirs_and_ignored_files_have_defaults() {
        let settings = SystemSettings::default();
        assert_eq!(
            settings.placeholder_dirs,
            vec![
                "node_modules".to_string(),
                "target".to_string(),
                "dist".to_string(),
                "build".to_string(),
                ".git".to_string(),
                ".svn".to_string(),
                ".hg".to_string(),
            ]
        );
        assert_eq!(
            settings.ignored_files,
            vec![".DS_Store".to_string(), "Thumbs.db".to_string()]
        );
    }

    #[test]
    fn empty_json_yields_default_placeholder_dirs() {
        let settings: SystemSettings = serde_json::from_str("{}").unwrap();
        assert!(settings
            .placeholder_dirs
            .contains(&"node_modules".to_string()));
        assert!(settings.ignored_files.contains(&".DS_Store".to_string()));
    }

    #[test]
    fn placeholder_dirs_and_ignored_files_round_trip() {
        let json = r#"{"placeholderDirs":["vendor"],"ignoredFiles":["*.tmp"]}"#;
        let settings: SystemSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.placeholder_dirs, vec!["vendor".to_string()]);
        assert_eq!(settings.ignored_files, vec!["*.tmp".to_string()]);

        let serialized = serde_json::to_string(&settings).unwrap();
        let round_tripped: SystemSettings = serde_json::from_str(&serialized).unwrap();
        assert_eq!(round_tripped.placeholder_dirs, settings.placeholder_dirs);
        assert_eq!(round_tripped.ignored_files, settings.ignored_files);
    }
}
