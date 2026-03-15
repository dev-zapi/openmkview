use crate::errors::AppResult;
use crate::models::HeadingInfo;
use pulldown_cmark::{html, Options, Parser};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderedMarkdown {
    pub html: String,
    pub headings: Vec<HeadingInfo>,
}

pub fn extract_headings(markdown: &str) -> Vec<HeadingInfo> {
    let mut headings = Vec::new();
    for line in markdown.lines() {
        if let Some(stripped) = line.strip_prefix('#') {
            let depth = stripped.chars().take_while(|&c| c == '#').count() + 1;
            if depth >= 1 && depth <= 6 {
                let text = stripped.trim_start_matches('#').trim();
                let clean_text = text
                    .replace('*', "")
                    .replace('_', "")
                    .replace('`', "")
                    .replace('[', "")
                    .replace(']', "");
                let id = text
                    .to_lowercase()
                    .chars()
                    .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
                    .collect::<String>()
                    .replace(' ', "-");
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

pub fn render_markdown(markdown: &str) -> AppResult<RenderedMarkdown> {
    let headings = extract_headings(markdown);

    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);

    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);

    Ok(RenderedMarkdown {
        html: html_output,
        headings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_headings_single_h1() {
        let markdown = "# Hello World";
        let headings = extract_headings(markdown);
        assert_eq!(headings.len(), 1);
        assert_eq!(headings[0].text, "Hello World");
        assert_eq!(headings[0].depth, 1);
    }

    #[test]
    fn test_extract_headings_multiple_levels() {
        let markdown = "# Title\n## Section\n### Subsection";
        let headings = extract_headings(markdown);
        assert_eq!(headings.len(), 3);
        assert_eq!(headings[0].depth, 1);
        assert_eq!(headings[1].depth, 2);
        assert_eq!(headings[2].depth, 3);
    }

    #[test]
    fn test_extract_headings_with_special_chars() {
        let markdown = "# **Bold** Title\n## `Code` Here";
        let headings = extract_headings(markdown);
        assert_eq!(headings.len(), 2);
        assert_eq!(headings[0].text, "Bold Title");
        assert_eq!(headings[1].text, "Code Here");
    }

    #[test]
    fn test_extract_headings_with_links() {
        let markdown = "# [Link](url) Text";
        let headings = extract_headings(markdown);
        assert_eq!(headings.len(), 1);
        assert!(headings[0].text.contains("Link"));
        assert!(headings[0].text.contains("Text"));
    }

    #[test]
    fn test_extract_headings_empty() {
        let markdown = "Just text\nNo headings here";
        let headings = extract_headings(markdown);
        assert_eq!(headings.len(), 0);
    }

    #[test]
    fn test_extract_headings_h6_only() {
        let markdown = "###### Deepest";
        let headings = extract_headings(markdown);
        assert_eq!(headings.len(), 1);
        assert_eq!(headings[0].depth, 6);
    }

    #[test]
    fn test_render_markdown_basic() {
        let markdown = "# Hello\n\nThis is **bold** text.";
        let rendered = render_markdown(markdown).unwrap();
        assert!(rendered.html.contains("<h1>"));
        assert!(rendered.html.contains("<strong>bold</strong>"));
        assert_eq!(rendered.headings.len(), 1);
    }

    #[test]
    fn test_render_markdown_tables() {
        let markdown = "| Col1 | Col2 |\n|------|------|\n| A | B |";
        let rendered = render_markdown(markdown).unwrap();
        assert!(rendered.html.contains("<table>"));
    }

    #[test]
    fn test_render_markdown_task_lists() {
        let markdown = "- [x] Done\n- [ ] Todo";
        let rendered = render_markdown(markdown).unwrap();
        assert!(rendered.html.contains("<input"));
    }

    #[test]
    fn test_render_markdown_strikethrough() {
        let markdown = "~~deleted~~";
        let rendered = render_markdown(markdown).unwrap();
        assert!(rendered.html.contains("<del>"));
    }

    #[test]
    fn test_render_markdown_empty() {
        let markdown = "";
        let rendered = render_markdown(markdown).unwrap();
        assert!(rendered.html.is_empty() || rendered.html == "");
    }
}
