use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde::Deserialize;
use std::path::PathBuf;
use std::process::Command;
use crate::AppState;
use crate::models::{GitFileStatus, GitFileStatusCode, GitLogEntry, GitStatus};

/// Git 操作请求
#[derive(Debug, Deserialize)]
pub struct GitRequest {
    action: String,
    project_id: i64,
    #[serde(default)]
    files: Option<Vec<String>>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    limit: Option<i32>,
    #[serde(default)]
    file_path: Option<String>,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    staged: Option<bool>,
    #[serde(default)]
    commit_hash: Option<String>,
}

/// 创建 Git 路由器
pub fn router() -> Router<AppState> {
    Router::new().route("/", post(execute_git))
}

/// 获取项目路径
fn get_project_path(db: &Database, project_id: i64) -> Result<PathBuf, StatusCode> {
    let conn = state.db.conn().lock().await;
    let path: String = conn
        .query_row("SELECT path FROM projects WHERE id = ?", [project_id], |row| {
            row.get(0)
        })
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    Ok(PathBuf::from(path))
}

/// 运行 Git 命令
fn run_git(cwd: &PathBuf, args: &[&str]) -> Result<(String, String), String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Git 执行失败：{}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if !output.status.success() {
        return Err(stderr);
    }
    
    Ok((stdout, stderr))
}

/// 解析 Git 状态输出
fn parse_status(stdout: &str) -> Vec<GitFileStatus> {
    let mut files = Vec::new();
    
    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        
        let chars: Vec<char> = line.chars().collect();
        let index = match chars[0] {
            ' ' => GitFileStatusCode::Unmodified,
            'M' => GitFileStatusCode::Modified,
            'A' => GitFileStatusCode::Added,
            'D' => GitFileStatusCode::Deleted,
            'R' => GitFileStatusCode::Renamed,
            'C' => GitFileStatusCode::Copied,
            'U' => GitFileStatusCode::Unmerged,
            '?' => GitFileStatusCode::Untracked,
            '!' => GitFileStatusCode::Ignored,
            _ => GitFileStatusCode::Unmodified,
        };
        
        let work_tree = match chars[1] {
            ' ' => GitFileStatusCode::Unmodified,
            'M' => GitFileStatusCode::Modified,
            'A' => GitFileStatusCode::Added,
            'D' => GitFileStatusCode::Deleted,
            '?' => GitFileStatusCode::Untracked,
            _ => GitFileStatusCode::Unmodified,
        };
        
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

/// 获取 Git 状态
fn git_status(cwd: &PathBuf) -> GitStatus {
    match run_git(cwd, &["status", "--porcelain"]) {
        Ok((stdout, _)) => {
            let files = parse_status(&stdout);
            
            let branch = run_git(cwd, &["branch", "--show-current"])
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
        }
    }
}

/// POST /api/git - 执行 Git 操作
async fn execute_git(
    Json(req): Json<GitRequest>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let cwd = get_project_path(&db, req.project_id)
        .map_err(|_| (StatusCode::NOT_FOUND, "项目未找到".to_string()))?;
    
    match req.action.as_str() {
        "status" => {
            let status = git_status(&cwd);
            Ok(Json(serde_json::to_value(status).unwrap()))
        }
        
        "add" => {
            let mut args = vec!["add"];
            if let Some(ref files) = req.files {
                for f in files {
                    args.push(f.as_str());
                }
            } else {
                args.push(".");
            }
            
            run_git(&cwd, &args)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let status = git_status(&cwd);
            Ok(Json(serde_json::to_value(status).unwrap()))
        }
        
        "commit" => {
            let message = req
                .message
                .as_ref()
                .ok_or_else(|| (StatusCode::BAD_REQUEST, "提交信息是必需的".to_string()))?;
            
            run_git(&cwd, &["commit", "-m", message])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let status = git_status(&cwd);
            Ok(Json(serde_json::to_value(status).unwrap()))
        }
        
        "push" => {
            run_git(&cwd, &["push"])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let status = git_status(&cwd);
            Ok(Json(serde_json::to_value(status).unwrap()))
        }
        
        "pull" => {
            let (stdout, stderr) = run_git(&cwd, &["pull"])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let status = git_status(&cwd);
            let mut value = serde_json::to_value(status).unwrap();
            value["output"] = serde_json::json!(format!("{}{}", stdout, stderr));
            Ok(Json(value))
        }
        
        "pull-rebase" => {
            let (stdout, stderr) = run_git(&cwd, &["pull", "--rebase"])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let status = git_status(&cwd);
            let mut value = serde_json::to_value(status).unwrap();
            value["output"] = serde_json::json!(format!("{}{}", stdout, stderr));
            Ok(Json(value))
        }
        
        "fetch" => {
            let (stdout, stderr) = run_git(&cwd, &["fetch", "--all"])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let status = git_status(&cwd);
            let mut value = serde_json::to_value(status).unwrap();
            value["output"] = serde_json::json!(format!("{}{}", stdout, stderr));
            Ok(Json(value))
        }
        
        "log" => {
            let limit = req.limit.unwrap_or(50);
            let format = "%H%x00%an%x00%ae%x00%aI%x00%s";
            
            let (stdout, _) = run_git(&cwd, &["log", &format!("--format={}", format), &format!("-n"), &limit.to_string()])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            let entries: Vec<GitLogEntry> = stdout
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('\0').collect();
                    if parts.len() >= 5 {
                        Some(GitLogEntry {
                            hash: parts[0].to_string(),
                            short_hash: parts[0][..7].to_string(),
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
            
            Ok(Json(serde_json::json!({ "entries": entries })))
        }
        
        "diff" => {
            let mut args = vec!["diff"];
            if let Some(ref path) = req.file_path {
                args.push("--");
                args.push(path);
            }
            
            let (stdout, _) = run_git(&cwd, &args)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            Ok(Json(serde_json::json!({ "diff": stdout })))
        }
        
        "diff-staged" => {
            let mut args = vec!["diff", "--cached"];
            if let Some(ref path) = req.file_path {
                args.push("--");
                args.push(path);
            }
            
            let (stdout, _) = run_git(&cwd, &args)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            Ok(Json(serde_json::json!({ "diff": stdout })))
        }
        
        "show" => {
            let commit_hash = req
                .commit_hash
                .or(req.message)
                .ok_or_else(|| (StatusCode::BAD_REQUEST, "提交哈希是必需的".to_string()))?;
            
            let (stdout, _) = run_git(&cwd, &["show", &commit_hash])
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            Ok(Json(serde_json::json!({ "diff": stdout })))
        }
        
        "file-at-head" => {
            let file_path = req
                .file_path
                .ok_or_else(|| (StatusCode::BAD_REQUEST, "文件路径是必需的".to_string()))?;
            
            match run_git(&cwd, &["show", &format!("HEAD:{}", file_path)]) {
                Ok((stdout, _)) => Ok(Json(serde_json::json!({ "content": stdout }))),
                Err(_) => Ok(Json(serde_json::json!({ "content": "" }))),
            }
        }
        
        "exec" => {
            let command = req
                .command
                .ok_or_else(|| (StatusCode::BAD_REQUEST, "命令是必需的".to_string()))?;
            
            let args: Vec<&str> = command.split_whitespace().collect();
            
            if args.is_empty() {
                return Err((StatusCode::BAD_REQUEST, "命令不能为空".to_string()));
            }
            
            let (stdout, stderr) = run_git(&cwd, &args)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            
            Ok(Json(serde_json::json!({ "output": format!("{}{}", stdout, stderr) })))
        }
        
        _ => Err((StatusCode::BAD_REQUEST, format!("未知操作：{}", req.action))),
    }
}
