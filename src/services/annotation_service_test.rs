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

#[test]
fn reply_appends_notes_to_the_thread_in_time_order() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let created = service
        .create(create_request(project_id, "doc.md", "First note"))
        .expect("create annotation");
    let first_note_id = created.notes[0].id;

    let after_first_reply = service
        .append_note(created.id, "Second note — **Markdown**")
        .expect("append first reply");
    assert_eq!(after_first_reply.notes.len(), 2);
    assert_eq!(after_first_reply.notes[0].id, first_note_id);
    assert_eq!(
        after_first_reply.notes[1].body,
        "Second note — **Markdown**"
    );

    let after_second_reply = service
        .append_note(created.id, "Third note")
        .expect("append second reply");
    let bodies: Vec<&str> = after_second_reply
        .notes
        .iter()
        .map(|note| note.body.as_str())
        .collect();
    assert_eq!(
        bodies,
        vec!["First note", "Second note — **Markdown**", "Third note"]
    );
    assert!(after_second_reply
        .notes
        .windows(2)
        .all(|pair| pair[0].id < pair[1].id));

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list annotations");
    assert_eq!(listed[0].notes.len(), 3);
}

#[test]
fn reply_requires_an_existing_annotation_and_a_non_empty_body() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);
    let created = service
        .create(create_request(project_id, "doc.md", "only note"))
        .expect("create annotation");

    let unknown = service.append_note(9999, "reply");
    assert!(matches!(unknown, Err(AppError::NotFound(_))));

    let empty = service.append_note(created.id, "   ");
    assert!(matches!(empty, Err(AppError::BadRequest(_))));
}

#[test]
fn editing_a_note_updates_only_that_note() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);
    let created = service
        .create(create_request(project_id, "doc.md", "First note"))
        .expect("create annotation");
    let second = service
        .append_note(created.id, "Second note")
        .expect("append reply");
    let first_note_id = created.notes[0].id;
    let second_note_id = second.notes[1].id;

    let updated = service
        .update_note(created.id, first_note_id, "Edited **first** note")
        .expect("edit note");

    assert_eq!(updated.notes[0].id, first_note_id);
    assert_eq!(updated.notes[0].body, "Edited **first** note");
    assert_eq!(updated.notes[1].id, second_note_id);
    assert_eq!(updated.notes[1].body, "Second note");
}

#[test]
fn editing_a_note_rejects_unknown_targets_and_empty_bodies() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);
    let created = service
        .create(create_request(project_id, "doc.md", "note"))
        .expect("create annotation");
    let note_id = created.notes[0].id;

    let unknown_annotation = service.update_note(9999, note_id, "edited");
    assert!(matches!(unknown_annotation, Err(AppError::NotFound(_))));

    let unknown_note = service.update_note(created.id, 9999, "edited");
    assert!(matches!(unknown_note, Err(AppError::NotFound(_))));

    let empty = service.update_note(created.id, note_id, "  ");
    assert!(matches!(empty, Err(AppError::BadRequest(_))));
}

#[test]
fn resolving_and_unresolving_a_thread_persists() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);
    let created = service
        .create(create_request(project_id, "doc.md", "note"))
        .expect("create annotation");
    assert!(!created.resolved);

    let resolved = service
        .set_resolved(created.id, true)
        .expect("resolve annotation");
    assert!(resolved.resolved);

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list annotations");
    assert!(listed[0].resolved);

    let unresolved = service
        .set_resolved(created.id, false)
        .expect("unresolve annotation");
    assert!(!unresolved.resolved);

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list annotations");
    assert!(!listed[0].resolved);

    let unknown = service.set_resolved(9999, true);
    assert!(matches!(unknown, Err(AppError::NotFound(_))));
}
