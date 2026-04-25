use crate::db::connection::init_db;
use crate::db::ProjectRepository;
use std::thread;
use std::time::Duration;
use tempfile::tempdir;

fn create_repo() -> (tempfile::TempDir, rusqlite::Connection) {
    let temp_dir = tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("test.db");
    let conn = init_db(&db_path).expect("init db");
    (temp_dir, conn)
}

#[test]
fn list_open_only_excludes_closed_projects() {
    let (_temp_dir, conn) = create_repo();
    let repo = ProjectRepository::new(&conn);

    let alpha = repo
        .create("/workspace/alpha", "alpha")
        .expect("create alpha");
    let beta = repo.create("/workspace/beta", "beta").expect("create beta");
    repo.close_project(beta.id).expect("close beta project");

    let open_projects = repo.list(true).expect("list open projects");
    let all_projects = repo.list(false).expect("list all projects");

    assert_eq!(open_projects.len(), 1);
    assert_eq!(open_projects[0].id, alpha.id);
    assert_eq!(all_projects.len(), 2);
}

#[test]
fn close_project_preserves_last_opened_at() {
    let (_temp_dir, conn) = create_repo();
    let repo = ProjectRepository::new(&conn);

    let project = repo
        .create("/workspace/alpha", "alpha")
        .expect("create project");
    let before = repo
        .find_by_id(project.id)
        .expect("find project before close")
        .expect("project exists before close");

    thread::sleep(Duration::from_secs(1));
    repo.close_project(project.id).expect("close project");

    let after = repo
        .find_by_id(project.id)
        .expect("find project after close")
        .expect("project exists after close");

    assert!(!after.is_open);
    assert_eq!(after.last_opened_at, before.last_opened_at);
}

#[test]
fn mark_opened_updates_last_opened_at() {
    let (_temp_dir, conn) = create_repo();
    let repo = ProjectRepository::new(&conn);

    let project = repo
        .create("/workspace/alpha", "alpha")
        .expect("create project");
    repo.close_project(project.id).expect("close project first");
    let before = repo
        .find_by_id(project.id)
        .expect("find project before reopen")
        .expect("project exists before reopen");

    thread::sleep(Duration::from_secs(1));
    repo.open_project(project.id).expect("reopen project");

    let after = repo
        .find_by_id(project.id)
        .expect("find project after reopen")
        .expect("project exists after reopen");

    assert!(after.is_open);
    assert!(after.last_opened_at > before.last_opened_at);
}
