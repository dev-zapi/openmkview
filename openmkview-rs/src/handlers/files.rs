use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::Deserialize;
use std::path::PathBuf;
use crate::AppState;
use crate::models::{FileTreeNode, Project};

/// 文件树查询参数
#[derive(Debug, Deserialize)]
pub struct FileTreeParams {
    project_id: i64,
}

/// 文件内容查询参数
#[derive(Debug, Deserialize)]
pub struct FileContentParams {
    path: String,
    project_id: i64,
}

/// 文件内容响应
#[derive(Debug, serde::Serialize)]
pub struct FileContentResponse {
    pub content: String,
    pub file_name: String,
    pub path: String,
}

/// 创建文件路由器
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/tree", get(get_file_tree))
        .route("/content", get(get_file_content))
}

/// GET /api/files/tree - 获取文件树
async fn get_file_tree(
    Query(params): Query<FileTreeParams>,
    State(state): State<AppState>,
) -> Result<Json<Vec<FileTreeNode>>, (StatusCode, String)> {
    let conn = state.db.conn().lock().await;
    
    // 获取项目路径
    let project_path: String = conn
        .query_row(
            "SELECT path FROM projects WHERE id = ?",
            [params.project_id],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "项目未找到".to_string()))?;
    
    // 使用 walkdir 遍历目录
    let mut files = Vec::new();
    let root_path = PathBuf::from(&project_path);
    
    for entry in walkdir::WalkDir::new(&root_path)
        .into_iter()
        .filter_entry(|e| {
            // 忽略 node_modules 和 .git
            let name = e.file_name().to_string_lossy();
            name != "node_modules" && name != ".git"
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "mdx" {
                    if let Ok(relative_path) = path.strip_prefix(&root_path) {
                        files.push(relative_path.to_path_buf());
                    }
                }
            }
        }
    }
    
    // 构建树结构
    let tree = build_tree_wrapper(&files, &root_path);
    
    Ok(Json(tree))
}

/// GET /api/files/content - 获取文件内容
async fn get_file_content(
    Query(params): Query<FileContentParams>,
    State(state): State<AppState>,
) -> Result<Json<FileContentResponse>, (StatusCode, String)> {
    let conn = state.db.conn().lock().await;
    
    // 获取项目路径
    let project_path: String = conn
        .query_row(
            "SELECT path FROM projects WHERE id = ?",
            [params.project_id],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "项目未找到".to_string()))?;
    
    // 安全验证：确保文件在项目目录内
    let file_path = PathBuf::from(&params.path);
    let resolved_file = file_path
        .canonicalize()
        .map_err(|_| (StatusCode::NOT_FOUND, "文件不存在".to_string()))?;
    
    let resolved_project = PathBuf::from(&project_path)
        .canonicalize()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "项目路径无效".to_string()))?;
    
    if !resolved_file.starts_with(&resolved_project) {
        return Err((StatusCode::FORBIDDEN, "访问被拒绝：文件在项目目录外".to_string()));
    }
    
    // 验证扩展名
    let ext = resolved_file
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "只支持 Markdown 文件".to_string()))?;
    
    if ext != "md" && ext != "mdx" {
        return Err((StatusCode::BAD_REQUEST, "只支持 Markdown 文件".to_string()));
    }
    
    // 读取文件内容
    let content = std::fs::read_to_string(&resolved_file)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "读取文件失败".to_string()))?;
    
    let file_name = resolved_file
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "无效的文件名".to_string()))?
        .to_string();
    
    Ok(Json(FileContentResponse {
        content,
        file_name,
        path: resolved_file
            .to_str()
            .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "路径编码错误".to_string()))?
            .to_string(),
    }))
}

/// 从文件路径列表构建树结构
fn build_tree(files: &[PathBuf], root_path: &PathBuf) -> Vec<FileTreeNode> {
    // 使用递归方式构建树
    fn build_node(
        files: &[&PathBuf],
        depth: usize,
        current_prefix: &str,
        root_path: &PathBuf,
    ) -> Vec<FileTreeNode> {
        use std::collections::BTreeMap;
        
        // 按下一个目录名分组
        let mut groups: BTreeMap<String, Vec<&PathBuf>> = BTreeMap::new();
        
        for file in files {
            let components: Vec<_> = file.components().collect();
            if components.len() > depth {
                let name = components[depth].as_os_str().to_string_lossy().to_string();
                let prefix = if current_prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{}", current_prefix, name)
                };
                
                // 检查是否匹配当前前缀
                if depth == 0 || prefix.starts_with(current_prefix) {
                    groups.entry(name).or_default().push(file);
                }
            }
        }
        
        let mut nodes = Vec::new();
        for (name, group_files) in groups {
            let is_file = group_files.iter().any(|f| f.components().count() == depth + 1);
            
            if is_file {
                // 创建文件节点
                for file in &group_files {
                    let full_path = root_path.join(file);
                    nodes.push(FileTreeNode {
                        id: format!("{}/{}", current_prefix, name).trim_start_matches('/').to_string(),
                        name: name.clone(),
                        path: full_path.to_str().unwrap_or("").to_string(),
                        is_folder: false,
                        children: None,
                    });
                }
            } else {
                // 创建文件夹节点并递归处理
                let child_prefix = if current_prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{}", current_prefix, name)
                };
                
                let children = build_node(&group_files, depth + 1, &child_prefix, root_path);
                
                nodes.push(FileTreeNode {
                    id: child_prefix.clone(),
                    name,
                    path: root_path.join(&child_prefix).to_str().unwrap_or("").to_string(),
                    is_folder: true,
                    children: Some(children),
                });
            }
        }
        
        nodes
    }
    
    build_node(&files.iter().collect::<Vec<_>>(), 0, "", root_path)
}

/// 对外公开的 build_tree 包装函数
pub fn build_tree_wrapper(files: &[PathBuf], root_path: &PathBuf) -> Vec<FileTreeNode> {
    let file_refs: Vec<&PathBuf> = files.iter().collect();
    let mut tree = build_node(&file_refs, 0, "", root_path);
    sort_tree(&mut tree);
    tree
}

/// 排序树节点（文件夹优先，然后按字母顺序）
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
