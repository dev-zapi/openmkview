use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ThemeType {
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub theme_type: ThemeType,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "builtin")]
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeListResponse {
    pub themes: Vec<Theme>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeInstallRequest {
    pub filename: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct ThemeMetadata {
    pub name: String,
    pub theme_type: ThemeType,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
}

pub fn get_builtin_themes() -> Vec<Theme> {
    vec![
        Theme {
            id: "light-default".to_string(),
            name: "Default".to_string(),
            theme_type: ThemeType::Light,
            description: Some("Default light theme".to_string()),
            author: None,
            version: None,
            is_builtin: true,
        },
        Theme {
            id: "light-warm".to_string(),
            name: "Warm".to_string(),
            theme_type: ThemeType::Light,
            description: Some("Warm and cozy light theme".to_string()),
            author: None,
            version: None,
            is_builtin: true,
        },
        Theme {
            id: "light-cool".to_string(),
            name: "Cool".to_string(),
            theme_type: ThemeType::Light,
            description: Some("Cool blue-gray light theme".to_string()),
            author: None,
            version: None,
            is_builtin: true,
        },
        Theme {
            id: "dark-default".to_string(),
            name: "Default".to_string(),
            theme_type: ThemeType::Dark,
            description: Some("Default dark theme".to_string()),
            author: None,
            version: None,
            is_builtin: true,
        },
        Theme {
            id: "dark-blue".to_string(),
            name: "Blue".to_string(),
            theme_type: ThemeType::Dark,
            description: Some("Deep blue dark theme".to_string()),
            author: None,
            version: None,
            is_builtin: true,
        },
        Theme {
            id: "dark-purple".to_string(),
            name: "Purple".to_string(),
            theme_type: ThemeType::Dark,
            description: Some("Purple tinted dark theme".to_string()),
            author: None,
            version: None,
            is_builtin: true,
        },
    ]
}
