use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitFileStatus {
    pub path: String,
    pub index: String,
    #[serde(rename = "workTree")]
    pub work_tree: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitStatus {
    pub branch: String,
    pub files: Vec<GitFileStatus>,
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitLogEntry {
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    #[serde(rename = "authorName")]
    pub author_name: String,
    #[serde(rename = "authorEmail")]
    pub author_email: String,
    pub date: String,
    pub message: String,
}

pub struct GitService;

impl GitService {
    pub fn run_git(cwd: &PathBuf, args: &[&str]) -> Result<(String, String), String> {
        let output = Command::new("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .map_err(|e| format!("Git execution failed: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok((stdout, stderr))
    }

    pub fn status(cwd: &PathBuf) -> GitStatus {
        match Self::run_git(cwd, &["status", "--porcelain"]) {
            Ok((stdout, _)) => {
                let files = Self::parse_status(&stdout);
                let branch = Self::run_git(cwd, &["branch", "--show-current"])
                    .map(|(out, _)| out.trim().to_string())
                    .unwrap_or_default();

                GitStatus {
                    is_repo: true,
                    branch,
                    files,
                    output: None,
                }
            }
            Err(_) => GitStatus {
                is_repo: false,
                branch: String::new(),
                files: Vec::new(),
                output: None,
            },
        }
    }

    pub(crate) fn parse_status(stdout: &str) -> Vec<GitFileStatus> {
        let mut files = Vec::new();
        for line in stdout.lines() {
            if line.len() < 4 {
                continue;
            }

            let chars: Vec<char> = line.chars().collect();
            let index = chars[0].to_string();
            let work_tree = chars[1].to_string();
            let path = if line.len() > 3 {
                line[3..].to_string()
            } else {
                String::new()
            };

            files.push(GitFileStatus {
                path,
                index,
                work_tree,
            });
        }
        files
    }

    pub fn log(cwd: &PathBuf, limit: i32) -> AppResult<Vec<GitLogEntry>> {
        let format = "%H%x00%an%x00%ae%x00%aI%x00%s";
        let (stdout, _) = Self::run_git(
            cwd,
            &[
                "log",
                &format!("--format={}", format),
                "-n",
                &limit.to_string(),
            ],
        )
        .map_err(AppError::GitError)?;

        let entries = stdout
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\0').collect();
                if parts.len() >= 5 {
                    Some(GitLogEntry {
                        hash: parts[0].to_string(),
                        short_hash: parts[0][..7.min(parts[0].len())].to_string(),
                        author_name: parts[1].to_string(),
                        author_email: parts[2].to_string(),
                        date: parts[3].to_string(),
                        message: parts[4].to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(entries)
    }

    pub fn diff(cwd: &PathBuf, staged: bool, file_path: Option<&str>) -> AppResult<String> {
        let mut args = if staged {
            vec!["diff", "--cached"]
        } else {
            vec!["diff"]
        };

        if let Some(path) = file_path {
            args.push("--");
            args.push(path);
        }

        let (stdout, _) = Self::run_git(cwd, &args).map_err(AppError::GitError)?;
        Ok(stdout)
    }

    pub fn show(cwd: &PathBuf, commit_hash: &str) -> AppResult<String> {
        let (stdout, _) = Self::run_git(cwd, &["show", commit_hash]).map_err(AppError::GitError)?;
        Ok(stdout)
    }

    pub fn file_at_head(cwd: &PathBuf, file_path: &str) -> AppResult<String> {
        let (stdout, _) =
            Self::run_git(cwd, &["show", &format!("HEAD:{}", file_path)]).unwrap_or_default();
        Ok(stdout)
    }

    pub fn branches(cwd: &PathBuf) -> AppResult<Vec<String>> {
        let (stdout, _) = Self::run_git(cwd, &["branch", "-a"]).map_err(AppError::GitError)?;

        let branches: Vec<String> = stdout
            .lines()
            .filter_map(|line| {
                let branch = line.trim().trim_start_matches("* ").to_string();
                if !branch.is_empty() {
                    Some(branch)
                } else {
                    None
                }
            })
            .collect();

        Ok(branches)
    }

    pub fn tags(cwd: &PathBuf) -> AppResult<Vec<String>> {
        let (stdout, _) = Self::run_git(cwd, &["tag", "-l"]).map_err(AppError::GitError)?;

        let tags: Vec<String> = stdout
            .lines()
            .filter(|l| !l.is_empty())
            .map(|l| l.trim().to_string())
            .collect();

        Ok(tags)
    }

    pub fn file_at_ref(cwd: &PathBuf, file_path: &str, reference: &str) -> AppResult<String> {
        let (stdout, _) = Self::run_git(cwd, &["show", &format!("{}:{}", reference, file_path)])
            .unwrap_or_default();
        Ok(stdout)
    }

    pub fn file_diff(
        cwd: &PathBuf,
        file_path: &str,
        old_ref: &str,
        new_ref: &str,
    ) -> AppResult<FileDiff> {
        let old_content = Self::file_at_ref(cwd, file_path, old_ref).unwrap_or_default();
        let new_content = Self::file_at_ref(cwd, file_path, new_ref).unwrap_or_default();

        let diff_output = Self::run_git(cwd, &["diff", old_ref, new_ref, "--", file_path])
            .map_err(AppError::GitError)?
            .0;

        let hunks = Self::parse_diff_hunks(&diff_output);

        Ok(FileDiff {
            old_file_name: file_path.to_string(),
            new_file_name: file_path.to_string(),
            old_content,
            new_content,
            hunks,
        })
    }

    fn parse_diff_hunks(diff_output: &str) -> Vec<DiffHunk> {
        let mut hunks = Vec::new();
        let mut current_hunk: Option<DiffHunk> = None;

        for line in diff_output.lines() {
            if line.starts_with("@@") {
                if let Some(hunk) = current_hunk.take() {
                    hunks.push(hunk);
                }

                if let Some((old_start, old_lines, new_start, new_lines)) =
                    Self::parse_hunk_header(line)
                {
                    current_hunk = Some(DiffHunk {
                        old_start,
                        old_lines,
                        new_start,
                        new_lines,
                        lines: Vec::new(),
                    });
                }
            } else if let Some(ref mut hunk) = current_hunk {
                if line.starts_with('+') && !line.starts_with("+++") {
                    hunk.lines.push(DiffLine {
                        line_type: "add".to_string(),
                        content: line[1..].to_string(),
                        old_line_number: None,
                        new_line_number: Some((hunk.lines.len() as u32) + hunk.new_start),
                    });
                } else if line.starts_with('-') && !line.starts_with("---") {
                    hunk.lines.push(DiffLine {
                        line_type: "remove".to_string(),
                        content: line[1..].to_string(),
                        old_line_number: Some((hunk.lines.len() as u32) + hunk.old_start),
                        new_line_number: None,
                    });
                } else if !line.starts_with("diff ")
                    && !line.starts_with("index ")
                    && !line.starts_with("--- ")
                    && !line.starts_with("+++ ")
                    && !line.is_empty()
                {
                    hunk.lines.push(DiffLine {
                        line_type: "normal".to_string(),
                        content: line.to_string(),
                        old_line_number: Some((hunk.lines.len() as u32) + hunk.old_start),
                        new_line_number: Some((hunk.lines.len() as u32) + hunk.new_start),
                    });
                }
            }
        }

        if let Some(hunk) = current_hunk {
            hunks.push(hunk);
        }

        hunks
    }

    fn parse_hunk_header(line: &str) -> Option<(u32, u32, u32, u32)> {
        let parts: Vec<&str> = line.split(' ').collect();
        if parts.len() >= 4 {
            let old_part = parts[1].trim_start_matches('-');
            let new_part = parts[3].trim_start_matches('+');

            let old_parts: Vec<&str> = old_part.split(',').collect();
            let new_parts: Vec<&str> = new_part.split(',').collect();

            let old_start = old_parts.first()?.parse().ok()?;
            let old_lines = old_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);
            let new_start = new_parts.first()?.parse().ok()?;
            let new_lines = new_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);

            return Some((old_start, old_lines, new_start, new_lines));
        }
        None
    }
}

#[cfg(test)]
#[path = "git_service_test.rs"]
mod git_service_test;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDiff {
    #[serde(rename = "oldFileName")]
    pub old_file_name: String,
    #[serde(rename = "newFileName")]
    pub new_file_name: String,
    #[serde(rename = "oldContent")]
    pub old_content: String,
    #[serde(rename = "newContent")]
    pub new_content: String,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffHunk {
    #[serde(rename = "oldStart")]
    pub old_start: u32,
    #[serde(rename = "oldLines")]
    pub old_lines: u32,
    #[serde(rename = "newStart")]
    pub new_start: u32,
    #[serde(rename = "newLines")]
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub line_type: String,
    pub content: String,
    #[serde(rename = "oldLineNumber")]
    pub old_line_number: Option<u32>,
    #[serde(rename = "newLineNumber")]
    pub new_line_number: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_status_empty() {
        let result = GitService::parse_status("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_status_single_modified() {
        let status = " M file.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "file.md");
        assert_eq!(result[0].index, " ");
        assert_eq!(result[0].work_tree, "M");
    }

    #[test]
    fn test_parse_status_multiple_files() {
        let status = "M  file1.md\nA  file2.md\n D file3.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].path, "file1.md");
        assert_eq!(result[0].index, "M");
        assert_eq!(result[1].path, "file2.md");
        assert_eq!(result[1].index, "A");
        assert_eq!(result[2].path, "file3.md");
        assert_eq!(result[2].work_tree, "D");
    }

    #[test]
    fn test_parse_status_staged_and_unstaged() {
        let status = "MM file.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].index, "M");
        assert_eq!(result[0].work_tree, "M");
    }

    #[test]
    fn test_parse_status_new_file() {
        let status = "A  newfile.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "newfile.md");
        assert_eq!(result[0].index, "A");
    }

    #[test]
    fn test_parse_status_deleted() {
        let status = "D  deleted.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "deleted.md");
        assert_eq!(result[0].index, "D");
    }

    #[test]
    fn test_parse_status_untracked() {
        let status = "?? untracked.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "untracked.md");
        assert_eq!(result[0].index, "?");
        assert_eq!(result[0].work_tree, "?");
    }

    #[test]
    fn test_parse_status_renamed() {
        let status = "R  old.md -> new.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "old.md -> new.md");
        assert_eq!(result[0].index, "R");
    }

    #[test]
    fn test_parse_status_with_spaces_in_path() {
        let status = "M  file with spaces.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "file with spaces.md");
    }

    #[test]
    fn test_parse_status_skip_short_lines() {
        let status = "AB\n M valid.md";
        let result = GitService::parse_status(status);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "valid.md");
    }

    #[test]
    fn test_run_git_success() {
        let cwd = PathBuf::from(".");
        let result = GitService::run_git(&cwd, &["--version"]);
        assert!(result.is_ok());
        let (stdout, _) = result.unwrap();
        assert!(stdout.contains("git version"));
    }

    #[test]
    fn test_run_git_invalid_command() {
        let cwd = PathBuf::from("/nonexistent/directory/path");
        let result = GitService::run_git(&cwd, &["status"]);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Git execution failed"));
    }

    #[test]
    fn test_status_returns_status() {
        let cwd = PathBuf::from(".");
        let status = GitService::status(&cwd);
        assert!(status.is_repo);
    }
}
