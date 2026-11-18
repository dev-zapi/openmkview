# Store Annotations in SQLite, Not Sidecar Files

Annotations are per-file user data, and OpenMKView opens arbitrary local directories as projects. The tempting design is a sidecar file next to the Markdown so annotations travel with the document. We decided against writing anything into the user's project tree: annotations live in `openmkview.db` (Data Root).

**Decision:**
- Annotations are stored in a new SQLite table in `openmkview.db`, associated with files by `(project_id, relative_path)`. This is the first file-scoped content metadata in the DB (existing tables: `projects`, `settings`).
- In-app path-changing operations maintain the association: rename updates the stored path; move-to-trash keeps the rows hidden while the file is out of the project; restore brings them back. External renames are not tracked — the data is retained and reachable through the annotation manager rather than deleted.
- The document files themselves are never modified to carry annotations.

**Considered Options:**
- Sidecar files (`foo.md.comments.json`) — rejected: travels with the file and can be committed to git, but a previewer has no business writing files into the directories it previews.
- Embedded HTML comments — rejected: mutates the document content, conflicting with the previewer role.
- localStorage — rejected: per-browser; the DB lives in Data Root and survives browser and machine changes alongside it.

**Consequences:**
- Annotations do not travel when a project directory is copied or shared. Acceptable for a single-user self-hosted tool; export/import was explicitly deferred and should be revisited if sharing ever becomes a use case.
- Deleted-via-trash files keep their annotation rows; the annotation manager's clear-all is the explicit cleanup path.
- Offline Mode keeps annotations read-only, consistent with ADR-0002 — no offline write queue is built for them.
