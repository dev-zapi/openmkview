mod auth_handler;
mod file_handler;
mod git_handler;
mod passkey_handler;
mod project_handler;
mod settings_handler;
mod theme_handler;
mod trash_handler;
mod version_handler;

pub use auth_handler::{auth_login, auth_logout, auth_status, auth_update_session_timeout};
pub use file_handler::{
    create_file, delete_file, get_file_content, get_file_tree, rename_file, save_file_content,
    search_favicons, serve_project_file,
};
pub use git_handler::{
    execute_git, get_branches, get_commits, get_file_at_ref, get_file_diff, get_tags,
};
pub use passkey_handler::{
    passkey_delete, passkey_list, passkey_login_finish, passkey_login_start,
    passkey_register_finish, passkey_register_start,
};
pub use project_handler::{
    close_project, create_project, get_recent_projects, list_projects, open_project, resolve_path,
    update_project, update_project_color, validate_project,
};
pub use settings_handler::{get_settings, update_settings};
pub use theme_handler::{
    delete_custom_theme, get_theme_css_content, install_custom_theme, list_themes,
};
pub use trash_handler::{
    clear_trash, delete_from_trash, get_trash_stats, list_trash, move_to_trash, restore_from_trash,
};
pub use version_handler::get_version;
