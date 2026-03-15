use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SystemSettings {
    #[serde(rename = "markdownWidth", default)]
    pub markdown_width: WidthSetting,
    #[serde(rename = "uiFont", default)]
    pub ui_font: FontSetting,
    #[serde(rename = "markdownFont", default)]
    pub markdown_font: FontSetting,
    #[serde(rename = "tableWidth", default)]
    pub table_width: TableWidthMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WidthSetting {
    #[serde(default)]
    pub mode: WidthMode,
    #[serde(rename = "fixedWidth", default = "default_width")]
    pub fixed_width: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FontSetting {
    #[serde(rename = "fontFamily", default)]
    pub font_family: String,
    #[serde(rename = "fontSize", default = "default_font_size")]
    pub font_size: String,
}

fn default_font_size() -> String {
    "14px".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TableWidthMode {
    Auto,
    #[default]
    Full,
}
