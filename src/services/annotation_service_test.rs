use super::*;
use crate::db::init_db;
use crate::db::ProjectRepository;
use crate::errors::AppError;
use crate::models::CreateAnnotationRequest;
use crate::paths::AppPaths;
use crate::services::TrashService;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

struct Fixture {
    temp_dir: TempDir,
    paths: AppPaths,
    conn: rusqlite::Connection,
    project_id: i64,
    project_dir: PathBuf,
}

fn fixture_with_files(files: &[(&str, &str)]) -> Fixture {
    let temp_dir = TempDir::new().unwrap();
    let paths = AppPaths {
        config_dir: temp_dir.path().join("config"),
        data_dir: temp_dir.path().join("data"),
    };
    paths.ensure_dirs().unwrap();

    let db_path = paths.data_dir.join("test.db");
    let conn = init_db(&db_path).unwrap();

    let project_dir = temp_dir.path().join("project");
    fs::create_dir_all(&project_dir).unwrap();
    for (relative_path, content) in files {
        let path = project_dir.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    let project = ProjectRepository::new(&conn)
        .create(project_dir.to_str().unwrap(), "project")
        .unwrap();

    Fixture {
        temp_dir,
        paths,
        conn,
        project_id: project.id,
        project_dir,
    }
}

fn setup() -> (TempDir, rusqlite::Connection, i64) {
    let fixture = fixture_with_files(&[
        ("doc.md", "# Title\n\nparagraph\n"),
        ("other.md", "# Other\n"),
    ]);
    (fixture.temp_dir, fixture.conn, fixture.project_id)
}

/// Creates a second, independent project inside the fixture's temp root.
fn add_second_project(fixture: &Fixture, files: &[(&str, &str)]) -> i64 {
    let project_dir = fixture.temp_dir.path().join("project-two");
    fs::create_dir_all(&project_dir).unwrap();
    for (relative_path, content) in files {
        let path = project_dir.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    ProjectRepository::new(&fixture.conn)
        .create(project_dir.to_str().unwrap(), "project-two")
        .unwrap()
        .id
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

#[test]
fn rename_moves_annotations_to_the_new_relative_path() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n")]);
    let service = AnnotationService::new(&fixture.conn);

    let created = service
        .create(create_request(fixture.project_id, "doc.md", "kept note"))
        .expect("create annotation");

    fs::rename(
        fixture.project_dir.join("doc.md"),
        fixture.project_dir.join("renamed.md"),
    )
    .expect("rename file on disk");

    let moved = service
        .migrate_paths(fixture.project_id, "doc.md", "renamed.md")
        .expect("migrate annotation paths");
    assert_eq!(moved, 1);

    let listed = service
        .list_for_file(fixture.project_id, "renamed.md")
        .expect("list moved annotations");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);
    assert_eq!(listed[0].relative_path, "renamed.md");
    assert_eq!(listed[0].notes[0].body, "kept note");

    assert!(service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list old path")
        .is_empty());
}

#[test]
fn directory_rename_moves_descendants_and_ignores_sibling_prefixes() {
    let fixture = fixture_with_files(&[
        ("docs/a.md", "# A\n"),
        ("docs/nested/b.md", "# B\n"),
        ("docs-other/c.md", "# C\n"),
    ]);
    let service = AnnotationService::new(&fixture.conn);

    service
        .create(create_request(fixture.project_id, "docs/a.md", "a note"))
        .expect("create a");
    service
        .create(create_request(
            fixture.project_id,
            "docs/nested/b.md",
            "b note",
        ))
        .expect("create b");
    let sibling = service
        .create(create_request(
            fixture.project_id,
            "docs-other/c.md",
            "c note",
        ))
        .expect("create c");

    fs::rename(
        fixture.project_dir.join("docs"),
        fixture.project_dir.join("renamed"),
    )
    .expect("rename directory on disk");

    let moved = service
        .migrate_paths(fixture.project_id, "docs", "renamed")
        .expect("migrate descendants");
    assert_eq!(moved, 2);

    assert_eq!(
        service
            .list_for_file(fixture.project_id, "renamed/a.md")
            .expect("list renamed a")
            .len(),
        1
    );
    assert_eq!(
        service
            .list_for_file(fixture.project_id, "renamed/nested/b.md")
            .expect("list renamed b")
            .len(),
        1
    );

    let untouched = service
        .list_for_file(fixture.project_id, "docs-other/c.md")
        .expect("list sibling");
    assert_eq!(untouched.len(), 1);
    assert_eq!(untouched[0].id, sibling.id);
}

#[test]
fn renaming_a_file_does_not_move_a_sibling_with_a_prefixed_name() {
    let fixture = fixture_with_files(&[("notes.md", "# Notes\n"), ("notes.md.bak", "# Backup\n")]);
    let service = AnnotationService::new(&fixture.conn);

    service
        .create(create_request(fixture.project_id, "notes.md", "main note"))
        .expect("create notes annotation");
    let backup = service
        .create(create_request(
            fixture.project_id,
            "notes.md.bak",
            "backup note",
        ))
        .expect("create backup annotation");

    fs::rename(
        fixture.project_dir.join("notes.md"),
        fixture.project_dir.join("renamed.md"),
    )
    .expect("rename notes file");

    let moved = service
        .migrate_paths(fixture.project_id, "notes.md", "renamed.md")
        .expect("migrate renamed file");
    assert_eq!(moved, 1);

    assert_eq!(
        service
            .list_for_file(fixture.project_id, "renamed.md")
            .expect("list renamed file")
            .len(),
        1
    );

    let untouched = service
        .list_for_file(fixture.project_id, "notes.md.bak")
        .expect("list prefixed sibling");
    assert_eq!(untouched.len(), 1);
    assert_eq!(untouched[0].id, backup.id);
}

#[test]
fn trash_hides_annotations_and_restore_brings_them_back() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n")]);
    let service = AnnotationService::new(&fixture.conn);

    let created = service
        .create(create_request(fixture.project_id, "doc.md", "trash note"))
        .expect("create annotation");

    let trashed = TrashService::move_to_trash(
        &fixture.project_dir,
        "doc.md",
        false,
        fixture.project_id,
        &fixture.paths,
    )
    .expect("move file to trash");
    assert!(!fixture.project_dir.join("doc.md").exists());
    assert!(service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list while trashed")
        .is_empty());

    TrashService::restore_from_trash(
        &fixture.project_dir,
        &trashed.id,
        fixture.project_id,
        &fixture.paths,
    )
    .expect("restore file");

    let listed = service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list after restore");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);
    assert_eq!(listed[0].notes[0].body, "trash note");
}

#[test]
fn external_rename_keeps_annotation_rows_queryable() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n")]);
    let service = AnnotationService::new(&fixture.conn);

    let created = service
        .create(create_request(
            fixture.project_id,
            "doc.md",
            "external note",
        ))
        .expect("create annotation");

    fs::rename(
        fixture.project_dir.join("doc.md"),
        fixture.project_dir.join("moved.md"),
    )
    .expect("rename file outside the app");

    // The old path is gone from the document surface, and the annotation was
    // not silently re-associated with some other file at the new path.
    assert!(service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list orphaned path")
        .is_empty());
    assert!(service
        .list_for_file(fixture.project_id, "moved.md")
        .expect("list new path")
        .is_empty());

    // Data is retained under its original path for the management panel.
    let retained = AnnotationRepository::new(&fixture.conn)
        .find_by_id(created.id)
        .expect("load retained annotation")
        .expect("annotation row remains");
    assert_eq!(retained.relative_path, "doc.md");
    assert_eq!(retained.notes[0].body, "external note");
}

#[test]
fn managed_list_covers_every_project_file_and_marks_missing_paths_as_orphaned() {
    let fixture = fixture_with_files(&[
        ("doc.md", "# Title\n"),
        ("other.md", "# Other\n"),
        ("gone.md", "# Gone\n"),
    ]);
    let service = AnnotationService::new(&fixture.conn);

    let doc = service
        .create(create_request(fixture.project_id, "doc.md", "doc note"))
        .expect("create doc annotation");
    let other = service
        .create(create_request(fixture.project_id, "other.md", "other note"))
        .expect("create other annotation");
    let gone = service
        .create(create_request(fixture.project_id, "gone.md", "orphan note"))
        .expect("create orphan annotation");

    fs::remove_file(fixture.project_dir.join("gone.md")).expect("remove file externally");

    let managed = service
        .list_for_project(fixture.project_id)
        .expect("list management annotations");

    assert_eq!(managed.len(), 3);
    let by_id = |id: i64| {
        managed
            .iter()
            .find(|entry| entry.annotation.id == id)
            .expect("managed row present")
    };

    assert!(!by_id(doc.id).orphaned);
    assert!(!by_id(other.id).orphaned);
    assert!(by_id(gone.id).orphaned);
    assert_eq!(by_id(gone.id).annotation.relative_path, "gone.md");
    assert_eq!(by_id(gone.id).annotation.notes[0].body, "orphan note");
}

#[test]
fn managed_list_does_not_leak_annotations_from_other_projects() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n")]);
    let service = AnnotationService::new(&fixture.conn);
    let second_project_id = add_second_project(&fixture, &[("second.md", "# Second\n")]);

    let first = service
        .create(create_request(
            fixture.project_id,
            "doc.md",
            "first project",
        ))
        .expect("create first annotation");
    let second = service
        .create(create_request(
            second_project_id,
            "second.md",
            "second project",
        ))
        .expect("create second annotation");

    let managed = service
        .list_for_project(fixture.project_id)
        .expect("list first project");

    assert_eq!(managed.len(), 1);
    assert_eq!(managed[0].annotation.id, first.id);
    assert!(managed
        .iter()
        .all(|entry| entry.annotation.project_id == fixture.project_id));

    let second_managed = service
        .list_for_project(second_project_id)
        .expect("list second project");
    assert_eq!(second_managed.len(), 1);
    assert_eq!(second_managed[0].annotation.id, second.id);
}

#[test]
fn batch_delete_removes_only_selected_ids_from_the_given_project() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n"), ("other.md", "# Other\n")]);
    let service = AnnotationService::new(&fixture.conn);
    let second_project_id = add_second_project(&fixture, &[("second.md", "# Second\n")]);

    let keep = service
        .create(create_request(fixture.project_id, "doc.md", "keep me"))
        .expect("create kept annotation");
    let first_to_delete = service
        .create(create_request(fixture.project_id, "doc.md", "delete one"))
        .expect("create first delete target");
    let cross_file_to_delete = service
        .create(create_request(fixture.project_id, "other.md", "delete two"))
        .expect("create cross-file delete target");
    let foreign = service
        .create(create_request(
            second_project_id,
            "second.md",
            "other project",
        ))
        .expect("create foreign annotation");

    let deleted = service
        .batch_delete(
            fixture.project_id,
            &[first_to_delete.id, cross_file_to_delete.id, foreign.id],
        )
        .expect("batch delete");

    assert_eq!(deleted, 2);

    let remaining = service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list remaining annotations");
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].id, keep.id);
    assert!(service
        .list_for_file(fixture.project_id, "other.md")
        .expect("list other file")
        .is_empty());

    let foreign_rows = service
        .list_for_file(second_project_id, "second.md")
        .expect("list foreign project annotations");
    assert_eq!(foreign_rows.len(), 1);
    assert_eq!(foreign_rows[0].id, foreign.id);
}

#[test]
fn batch_delete_with_no_ids_is_a_no_op() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);
    service
        .create(create_request(project_id, "doc.md", "still here"))
        .expect("create annotation");

    let deleted = service.batch_delete(project_id, &[]).expect("batch delete");

    assert_eq!(deleted, 0);
    assert_eq!(
        service
            .list_for_file(project_id, "doc.md")
            .expect("list annotations")
            .len(),
        1
    );
}

#[test]
fn batch_resolve_updates_only_selected_ids_in_the_given_project() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n"), ("other.md", "# Other\n")]);
    let service = AnnotationService::new(&fixture.conn);
    let second_project_id = add_second_project(&fixture, &[("second.md", "# Second\n")]);

    let first = service
        .create(create_request(fixture.project_id, "doc.md", "first"))
        .expect("create first annotation");
    let cross_file = service
        .create(create_request(fixture.project_id, "other.md", "cross file"))
        .expect("create cross-file annotation");
    let untouched = service
        .create(create_request(fixture.project_id, "doc.md", "untouched"))
        .expect("create untouched annotation");
    let foreign = service
        .create(create_request(second_project_id, "second.md", "foreign"))
        .expect("create foreign annotation");

    let resolved = service
        .batch_resolve(
            fixture.project_id,
            &[first.id, cross_file.id, foreign.id],
            true,
        )
        .expect("batch resolve");

    assert_eq!(resolved, 2);
    let listed = service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list annotations");
    assert!(
        listed
            .iter()
            .find(|entry| entry.id == first.id)
            .expect("first present")
            .resolved
    );
    assert!(
        !listed
            .iter()
            .find(|entry| entry.id == untouched.id)
            .expect("untouched present")
            .resolved
    );

    let other_rows = service
        .list_for_file(fixture.project_id, "other.md")
        .expect("list other file");
    assert!(other_rows[0].resolved);

    let foreign_rows = service
        .list_for_file(second_project_id, "second.md")
        .expect("list foreign annotations");
    assert!(!foreign_rows[0].resolved);

    let unresolved = service
        .batch_resolve(fixture.project_id, &[first.id], false)
        .expect("batch unresolve");
    assert_eq!(unresolved, 1);
    let listed = service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list after unresolve");
    assert!(
        !listed
            .iter()
            .find(|entry| entry.id == first.id)
            .expect("first present")
            .resolved
    );
    assert!(
        service
            .list_for_file(fixture.project_id, "other.md")
            .expect("list other file after unresolve")[0]
            .resolved
    );
}

#[test]
fn batch_resolve_with_no_ids_is_a_no_op() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let updated = service
        .batch_resolve(project_id, &[], true)
        .expect("batch resolve");

    assert_eq!(updated, 0);
}

#[test]
fn clear_project_removes_every_annotation_in_only_that_project() {
    let fixture = fixture_with_files(&[("doc.md", "# Title\n"), ("other.md", "# Other\n")]);
    let service = AnnotationService::new(&fixture.conn);
    let second_project_id = add_second_project(&fixture, &[("second.md", "# Second\n")]);

    let first = service
        .create(create_request(fixture.project_id, "doc.md", "first"))
        .expect("create first annotation");
    service
        .create(create_request(fixture.project_id, "other.md", "second"))
        .expect("create second annotation");
    let foreign = service
        .create(create_request(second_project_id, "second.md", "foreign"))
        .expect("create foreign annotation");

    let deleted = service
        .clear_project(fixture.project_id)
        .expect("clear project annotations");

    assert_eq!(deleted, 2);
    assert!(service
        .list_for_file(fixture.project_id, "doc.md")
        .expect("list doc")
        .is_empty());
    assert!(service
        .list_for_file(fixture.project_id, "other.md")
        .expect("list other")
        .is_empty());

    let foreign_rows = service
        .list_for_file(second_project_id, "second.md")
        .expect("list foreign project");
    assert_eq!(foreign_rows.len(), 1);
    assert_eq!(foreign_rows[0].id, foreign.id);

    let note_count: i64 = fixture
        .conn
        .query_row(
            "SELECT COUNT(*) FROM annotation_notes WHERE annotation_id = ?",
            [first.id],
            |row| row.get(0),
        )
        .expect("count cleared notes");
    assert_eq!(note_count, 0);
}

#[test]
fn clear_project_with_no_annotations_returns_zero() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let deleted = service.clear_project(project_id).expect("clear project");

    assert_eq!(deleted, 0);
}

#[test]
fn create_records_the_original_text_as_its_snapshot() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let created = service
        .create(create_request(project_id, "doc.md", "first note"))
        .expect("create annotation");
    assert_eq!(created.snapshot.as_deref(), Some("paragraph"));

    let mut request = create_request_with_anchor(text_anchor());
    request.project_id = project_id;
    let selected = service.create(request).expect("create text annotation");
    assert_eq!(selected.snapshot.as_deref(), Some("quick brown"));
}

#[test]
fn reanchor_replaces_the_anchor_and_refreshes_the_snapshot() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let created = service
        .create(create_request(project_id, "doc.md", "drifted note"))
        .expect("create annotation");
    assert_eq!(created.snapshot.as_deref(), Some("paragraph"));

    let reanchored = service
        .reanchor(created.id, text_anchor())
        .expect("re-anchor annotation");

    assert_eq!(reanchored.id, created.id);
    assert_eq!(reanchored.anchor, text_anchor());
    assert_eq!(reanchored.snapshot.as_deref(), Some("quick brown"));
    assert_eq!(reanchored.notes[0].body, "drifted note");

    let listed = service
        .list_for_file(project_id, "doc.md")
        .expect("list re-anchored annotation");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].anchor, text_anchor());
    assert_eq!(listed[0].snapshot.as_deref(), Some("quick brown"));
}

#[test]
fn reanchor_rejects_an_unknown_annotation() {
    let (_temp_dir, conn, _project_id) = setup();
    let service = AnnotationService::new(&conn);

    let result = service.reanchor(9999, block_anchor());

    assert!(matches!(result, Err(AppError::NotFound(_))));
}

#[test]
fn reanchor_rejects_a_malformed_anchor() {
    let (_temp_dir, conn, project_id) = setup();
    let service = AnnotationService::new(&conn);

    let created = service
        .create(create_request(project_id, "doc.md", "note"))
        .expect("create annotation");

    let result = service.reanchor(created.id, json!({ "version": 1, "segments": [] }));

    assert!(matches!(result, Err(AppError::BadRequest(_))));
}
