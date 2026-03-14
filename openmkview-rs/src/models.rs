use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use pulldown_cmark::{Parser, Options, html};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub last_opened_at: String,
    pub is_open: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
}

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

fn default_width() -> String { "70%".to_string() }

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

fn default_font_size() -> String { "14px".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TableWidthMode {
    Auto,
    #[default]
    Full,
}

/// 构建文件树
pub fn build_tree(files: &[PathBuf], root_path: &Path) -> Vec<FileTreeNode> {
    use std::collections::BTreeMap;
    
    fn build_node(
        files: &[&PathBuf],
        depth: usize,
        current_prefix: &str,
        root_path: &Path,
    ) -> Vec<FileTreeNode> {
        let mut groups: BTreeMap<String, Vec<&PathBuf>> = BTreeMap::new();
        
        for file in files {
            let components: Vec<_> = file.components().collect();
            if components.len() > depth {
                let name = components[depth].as_os_str().to_string_lossy().to_string();
                groups.entry(name).or_default().push(file);
            }
        }
        
        let mut nodes = Vec::new();
        for (name, group_files) in groups {
            let is_file = group_files.iter().any(|f| f.components().count() == depth + 1);
            
            if is_file {
                for file in &group_files {
                    let full_path = root_path.join(file);
                    nodes.push(FileTreeNode {
                        id: file.to_str().unwrap().to_string(),
                        name: name.clone(),
                        path: full_path.to_str().unwrap().to_string(),
                        is_folder: false,
                        children: None,
                    });
                }
            } else {
                let child_prefix = if current_prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{}", current_prefix, name)
                };
                
                let children = build_node(&group_files, depth + 1, &child_prefix, root_path);
                
                nodes.push(FileTreeNode {
                    id: child_prefix.clone(),
                    name,
                    path: root_path.join(&child_prefix).to_str().unwrap().to_string(),
                    is_folder: true,
                    children: Some(children),
                });
            }
        }
        
        nodes
    }
    
    let file_refs: Vec<&PathBuf> = files.iter().collect();
    let mut tree = build_node(&file_refs, 0, "", root_path);
    sort_tree(&mut tree);
    tree
}

fn sort_tree(nodes: &mut [FileTreeNode]) {
    nodes.sort_by(|a, b| {
        if a.is_folder && !b.is_folder {
            std::cmp::Ordering::Less
        } else if !a.is_folder && b.is_folder {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });
    
    for node in nodes.iter_mut() {
        if let Some(children) = &mut node.children {
            sort_tree(children);
        }
    }
}

/// Markdown 标题信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadingInfo {
    pub id: String,
    pub text: String,
    pub depth: i32,
}

/// Markdown 渲染结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderedMarkdown {
    pub html: String,
    pub headings: Vec<HeadingInfo>,
}

/// 提取 Markdown 标题
pub fn extract_headings(markdown: &str) -> Vec<HeadingInfo> {
    let mut headings = Vec::new();
    
    for line in markdown.lines() {
        if let Some(stripped) = line.strip_prefix('#') {
            let depth = 1 + line.chars().take_while(|&c| c == '#').count() - stripped.chars().take_while(|&c| c == '#').count();
            if depth >= 1 && depth <= 6 {
                let text = stripped.trim_start_matches('#').trim();
                // 移除 Markdown 格式
                let clean_text = text
                    .replace('*', "")
                    .replace('_', "")
                    .replace('`', "")
                    .replace('[', "")
                    .replace(']', "");
                
                let id = text_to_id(&clean_text);
                headings.push(HeadingInfo {
                    id,
                    text: clean_text,
                    depth: depth as i32,
                });
            }
        }
    }
    
    headings
}

/// 将文本转换为 ID（用于锚点）
fn text_to_id(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
        .collect::<String>()
        .replace(' ', "-")
}

/// 渲染 Markdown 为 HTML
pub fn render_markdown(markdown: &str) -> RenderedMarkdown {
    let headings = extract_headings(markdown);
    
    // 设置 pulldown-cmark 选项
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    
    // 解析并渲染 Markdown
    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    RenderedMarkdown {
        html: html_output,
        headings,
    }
}
