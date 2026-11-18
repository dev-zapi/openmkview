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
