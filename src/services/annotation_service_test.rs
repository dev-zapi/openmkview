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

    let note_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM annotation_notes WHERE annotation_id = ?",
            [created.id],
            |row| row.get(0),
        )
        .expect("count notes before delete");
    assert_eq!(note_count, 1);

    service.delete(created.id).expect("delete annotation");

    let note_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM annotation_notes WHERE annotation_id = ?",
            [created.id],
            |row| row.get(0),
        )
        .expect("count notes after delete");
    assert_eq!(note_count, 0);

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

fn text_anchor() -> Value {
    json!({
        "version": 1,
        "segments": [{
            "kind": "text",
            "blockHash": "blk-text",
            "blockText": "The quick brown fox jumps.",
            "blockType": "p",
            "headingPath": ["Intro"],
            "quote": "quick brown",
            "prefix": "The ",
            "suffix": " fox jumps."
        }]
    })
}

fn create_request_with_anchor(anchor: Value) -> CreateAnnotationRequest {
    CreateAnnotationRequest {
        project_id: 1,
        relative_path: "doc.md".to_string(),
        anchor,
        body: "Selection note".to_string(),
    }
}

#[test]
fn create_accepts_a_text_segment_anchor() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);
    let mut request = create_request_with_anchor(text_anchor());
    request.project_id = project_id;

    let created = service
        .create(request)
        .expect("create text anchor annotation");

    assert_eq!(created.anchor, text_anchor());
}

#[test]
fn create_rejects_malformed_anchors() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let malformed = [
        json!(["not an object"]),
        json!({ "version": 1 }),
        json!({ "version": 1, "segments": [] }),
        json!({
            "version": 1,
            "segments": [{
                "kind": "text",
                "blockHash": "blk-text",
                "blockText": "text",
                "blockType": "p",
                "headingPath": [],
                "quote": "   ",
                "prefix": "",
                "suffix": ""
            }]
        }),
        json!({
            "version": 1,
            "segments": [{
                "kind": "text",
                "blockHash": "blk-text",
                "blockText": "text",
                "blockType": "p",
                "headingPath": "Intro",
                "quote": "text",
                "prefix": "",
                "suffix": ""
            }]
        }),
        json!({
            "version": 1,
            "segments": [{
                "kind": "block",
                "blockHash": "blk-block",
                "blockText": "text",
                "blockType": "p",
                "headingPath": []
            }, {
                "kind": "unknown",
                "blockHash": "blk-block"
            }]
        }),
    ];

    for anchor in malformed {
        let mut request = create_request_with_anchor(anchor.clone());
        request.project_id = project_id;
        let result = service.create(request);
        assert!(
            matches!(result, Err(AppError::BadRequest(_))),
            "expected BadRequest for anchor {anchor}, got {result:?}"
        );
    }
}
