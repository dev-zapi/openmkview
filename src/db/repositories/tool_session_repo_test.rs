use crate::db::connection::init_db;
use crate::db::{hash_tool_session_token, ToolSessionRepository};
use tempfile::tempdir;

fn create_conn() -> (tempfile::TempDir, rusqlite::Connection) {
    let temp_dir = tempdir().expect("temp dir");
    let conn = init_db(&temp_dir.path().join("test.db")).expect("init db");
    (temp_dir, conn)
}

#[test]
fn create_persists_token_hash_not_plaintext() {
    let (_temp_dir, conn) = create_conn();
    let repo = ToolSessionRepository::new(&conn);
    let token = "plaintext-tool-session-token";

    let session = repo
        .create(&hash_tool_session_token(token), "laptop")
        .expect("create session");

    assert_eq!(session.label, "laptop");
    assert!(!session.created_at.is_empty());
    assert_eq!(session.last_used_at, None);

    let stored: String = conn
        .query_row(
            "SELECT token_hash FROM tool_sessions WHERE id = ?",
            [session.id],
            |row| row.get(0),
        )
        .expect("read stored hash");
    assert_eq!(stored, hash_tool_session_token(token));
    assert_ne!(stored, token);
}

#[test]
fn list_returns_sessions_newest_first() {
    let (_temp_dir, conn) = create_conn();
    let repo = ToolSessionRepository::new(&conn);

    repo.create(&hash_tool_session_token("token-a"), "alpha")
        .expect("create alpha");
    repo.create(&hash_tool_session_token("token-b"), "beta")
        .expect("create beta");

    let sessions = repo.list().expect("list sessions");
    assert_eq!(sessions.len(), 2);
    assert_eq!(sessions[0].label, "beta");
    assert_eq!(sessions[1].label, "alpha");
}

#[test]
fn find_by_token_hash_and_touch_records_last_used() {
    let (_temp_dir, conn) = create_conn();
    let repo = ToolSessionRepository::new(&conn);
    let token = "token-for-touch";
    let hash = hash_tool_session_token(token);

    repo.create(&hash, "touch me").expect("create session");

    let found = repo
        .find_by_token_hash(&hash)
        .expect("find session")
        .expect("session exists");
    assert_eq!(found.last_used_at, None);

    repo.touch_last_used(found.id).expect("touch session");

    let touched = repo
        .find_by_token_hash(&hash)
        .expect("find touched session")
        .expect("session still exists");
    assert!(touched.last_used_at.is_some());
}

#[test]
fn delete_removes_session_and_reports_unknown_ids() {
    let (_temp_dir, conn) = create_conn();
    let repo = ToolSessionRepository::new(&conn);

    let session = repo
        .create(&hash_tool_session_token("token-c"), "disposable")
        .expect("create session");

    assert!(repo.delete(session.id).expect("delete session"));
    assert!(repo.list().expect("list sessions").is_empty());
    assert!(!repo.delete(session.id).expect("delete again"));
}

#[test]
fn find_by_token_hash_returns_none_for_unknown_hash() {
    let (_temp_dir, conn) = create_conn();
    let repo = ToolSessionRepository::new(&conn);

    let found = repo
        .find_by_token_hash(&hash_tool_session_token("never-issued"))
        .expect("lookup unknown hash");
    assert!(found.is_none());
}
