mod file_handler;
mod git_handler;
mod project_handler;
mod settings_handler;

pub use file_handler::{
    create_file, delete_file, get_file_content, get_file_tree, rename_file, search_favicons,
};
pub use git_handler::{
    execute_git, get_branches, get_commits, get_file_at_ref, get_file_diff, get_tags,
};
pub use project_handler::{
    close_project, create_project, get_recent_projects, list_projects, open_project, resolve_path,
    update_project, update_project_color, validate_project,
};
pub use settings_handler::{get_settings, update_settings};
