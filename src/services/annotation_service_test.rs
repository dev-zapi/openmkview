use super::*;
use crate::db::init_db;
use crate::db::ProjectRepository;
use crate::errors::AppError;
use crate::models::CreateAnnotationRequest;
use serde_json::{json, Value};
use std::fs;
use tempfile::TempDir;

fn setup() -> (TempDir, rusqlite::Connection, i64) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let conn = init_db(&db_path).unwrap();

    let project_dir = temp_dir.path().join("project");
    fs::create_dir_all(&project_dir).unwrap();
    fs::write(project_dir.join("doc.md"), "# Title\n\nparagraph\n").unwrap();
    fs::write(project_dir.join("other.md"), "# Other\n").unwrap();

    let project = ProjectRepository::new(&conn)
        .create(project_dir.to_str().unwrap(), "project")
        .unwrap();

    (temp_dir, conn, project.id)
}

fn block_anchor() -> Value {
    json!({
        "version": 1,
        "segments": [{
            "kind": "block",
            "blockHash": "blk-abc123",
            "blockText": "paragraph",
            "blockType": "p",
            "headingPath": ["Title"]
        }]
    })
}

fn create_request(project_id: i64, relative_path: &str, body: &str) -> CreateAnnotationRequest {
    CreateAnnotationRequest {
        project_id,
        relative_path: relative_path.to_string(),
        anchor: block_anchor(),
        body: body.to_string(),
    }
}

#[test]
fn creates_and_lists_annotation_with_first_note() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let created = service
        .create(create_request(project_id, "doc.md", "First note"))
        .expect("create annotation");

    assert!(created.id > 0);
    assert_eq!(created.project_id, project_id);
    assert_eq!(created.relative_path, "doc.md");
    assert_eq!(created.anchor, block_anchor());
    assert!(!created.resolved);
    assert_eq!(created.notes.len(), 1);
    assert_eq!(created.notes[0].body, "First note");
    assert_eq!(created.notes[0].annotation_id, created.id);

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list annotations");

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);
    assert_eq!(listed[0].notes.len(), 1);
}

#[test]
fn listing_is_scoped_to_the_requested_file() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    service
        .create(create_request(project_id, "doc.md", "on doc"))
        .expect("create doc annotation");
    service
        .create(create_request(project_id, "other.md", "on other"))
        .expect("create other annotation");

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list annotations");

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].relative_path, "doc.md");
    assert_eq!(listed[0].notes[0].body, "on doc");
}

#[test]
fn delete_removes_the_annotation_and_its_notes() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let created = service
        .create(create_request(project_id, "doc.md", "temporary"))
        .expect("create annotation");

    service.delete(created.id).expect("delete annotation");

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list annotations");
    assert!(listed.is_empty());
}

#[test]
fn delete_unknown_annotation_returns_not_found() {
    let (_temp_dir, conn, _project_id) = setup();
    let service = AnnotationService::new(&conn);

    let result = service.delete(9999);

    assert!(matches!(result, Err(AppError::NotFound(_))));
}

#[test]
fn create_rejects_unknown_project() {
    let (_temp_dir, conn, _project_id) = setup();
    let service = AnnotationService::new(&conn);

    let result = service.create(create_request(9999, "doc.md", "note"));

    assert!(matches!(result, Err(AppError::NotFound(_))));
}

#[test]
fn create_rejects_empty_note_body() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let result = service.create(create_request(project_id, "doc.md", "   "));

    assert!(matches!(result, Err(AppError::BadRequest(_))));
}

#[test]
fn create_rejects_path_traversal() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let result = service.create(create_request(project_id, "../escape.md", "note"));

    assert!(matches!(result, Err(AppError::ValidationError(_))));
}
