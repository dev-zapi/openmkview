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
fn test_parse_exec_command_allows_expected_commands() {
    let result = GitService::parse_exec_command("status --porcelain").unwrap();
    assert_eq!(result, vec!["status", "--porcelain"]);
}

#[test]
fn test_parse_exec_command_rejects_disallowed_subcommand() {
    let result = GitService::parse_exec_command("config core.sshCommand evil");
    assert!(result.is_err());
}

#[test]
fn test_parse_exec_command_rejects_dash_c_option() {
    let result = GitService::parse_exec_command("status -c core.sshCommand=evil");
    assert!(result.is_err());
}

#[test]
fn test_status_returns_status() {
    let cwd = PathBuf::from(".");
    let status = GitService::status(&cwd);
    assert!(status.is_repo);
}
