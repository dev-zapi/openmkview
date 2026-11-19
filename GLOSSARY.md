# OpenMKView

A Markdown file previewer with a three-pane layout (Activity Bar → File Browser → Markdown Viewer), using SQLite for persistence.

## Language

**Config Root**:
The base directory for user-facing settings and themes. Contains `config.toml` and `themes/`. Default: `$XDG_CONFIG_HOME/openmkview` or `~/.config/openmkview`. Overridable via `OPENMKVIEW_CONFIG_HOME`.
_Avoid_: config directory, settings path, configuration home

**Data Root**:
The base directory for runtime-generated state. Contains `openmkview.db`, `trash/`, and `passkeys.json`. Default: `$XDG_DATA_HOME/openmkview` or `~/.local/share/openmkview`. Overridable via `OPENMKVIEW_DATA_HOME`.
_Avoid_: data directory, storage path, database location

**AppPaths**:
A struct injected via `web::Data<AppPaths>` that encapsulates both Config Root and Data Root. Services receive it in constructors; tests construct their own with temporary directories.
_Avoid_: path config, directory manager, file system context

**XDG Base Directory**:
A freedesktop.org standard defining default locations for application configuration and data files. OpenMKView follows this convention: config in `$XDG_CONFIG_HOME`, data in `$XDG_DATA_HOME`.
_Avoid_: platform paths, OS directories, system locations

**Offline Mode**:
The read-only state the app enters automatically when the server is unreachable. The app shell and previously viewed file lists and file contents remain available from browser caches; editing is disabled and opening uncached content shows an empty-state message. Only an explicit 401 marks the session unauthenticated — a network failure never does. See `docs/adr/0002-offline-read-only-pwa.md`.
_Avoid_: offline support, read-only mode, disconnected state

**Table Density**:
The cell-padding preset for tables rendered from Markdown, chosen from three levels — small, medium (default), and large. Applies to Markdown body tables and the frontmatter panel table; the diff view is excluded.
_Avoid_: 表格间距, cell size, padding level, table spacing

**Table Wrapping**:
Whether cells in Markdown-rendered tables wrap onto multiple lines (default) or stay on a single line, in which case the table scrolls horizontally when it overflows its container. Applies to Markdown body tables only.
_Avoid_: nowrap, table overflow, horizontal scroll, table scroll

**Custom Stylesheet**:
A block of raw CSS supplied by the user that is injected to override the appearance of rendered Markdown content. Scoped to the Markdown view, so it cannot restyle the application shell.
_Avoid_: custom CSS, user styles, theme override, user stylesheet

**Registered Project**:
A directory known to the instance: a row with a unique path in the projects table. Registration persists — Closing a project only hides it, and no operation unregisters or deletes one.
_Avoid_: added project, project entry, 已注册项目

**Closed**:
The sidebar-hidden state of a Registered Project. A Closed project keeps its registration and stays fully addressable by id or path across the API and the annotation CLI; it is merely absent from the file browser.
_Avoid_: unregistered, removed project, deleted project, inactive

**Containing Project**:
The deepest Registered Project whose root is a given directory or an ancestor of it. Resolves a file path or a working directory to one project; when registrations nest, path depth wins, never registration order.
_Avoid_: parent project, owning project, closest project, enclosing project

**Menu Target**:
The project whose context menu is currently open in the activity bar. Distinct from the Active Project; a menu target may or may not be the active project. Derived from color picker state. When the color picker closes, the menu target becomes null.
_Avoid_: context menu target, right-clicked project, selected project, focused project

**Active Project**:
The project currently being worked on, whose files appear in the file tree and main pane. Changed by clicking a project icon in the activity bar or opening a new project. At most one project is active at a time.
_Avoid_: current project, working project, focused project, selected project

**Hidden Entry**:
A file or directory whose name starts with a dot, excluded from the file tree by default following Linux convention. Visibility is a per-browser preference toggled from the project menu; it is hiding, not removal.
_Avoid_: dotfile, hidden file, invisible entry, hidden system file

**Ignored Files**:
Junk files that never appear in the file tree regardless of the hidden toggle. Unlike Hidden Entries, which are merely hidden by default, ignored files are always gone.
_Avoid_: junk list, blocked files, excluded files, prune list

**Placeholder Directory**:
A heavy directory (dependency caches, VCS internals) shown in the file tree as a node that cannot be expanded; opening it shows a notice instead of its contents. Dot-prefixed members additionally follow Hidden Entry visibility.
_Avoid_: collapsed directory, pruned directory, lazy directory, system directory

**Source Fallback**:
The read-only, syntax-highlighted source rendering used for any text file without a dedicated renderer (markdown, HTML, and images keep their own). It is the only view for such files: no preview, edit, or diff.
_Avoid_: code view, raw view, plain text view, unsupported file view

**Edit Mode**:
The viewing mode that opens a Markdown or HTML file in the editor, one of the four tabs alongside Preview, Source, and Diff. Offered only for Markdown and HTML files.
_Avoid_: editor mode, editing view, edit tab, source editing

**Editor Font Size**:
The font size of the editor shown in Edit Mode. When unset, it follows the Code Block Font Size.
_Avoid_: edit font size, editor zoom, code font size, editor text size

**Writing Mode**:
A sub-mode of Edit Mode, offered only for Markdown files, that restyles the editor for prose with proportional typography in a centered column. Session-scoped and per-file: never persisted, and each file keeps its own state only until reload.
_Avoid_: focus mode, zen mode, typewriter mode, 沉浸模式, 专注模式

**Typewriter Scrolling**:
An optional Writing Mode enhancement that keeps the caret vertically centered in the viewport while typing. Toggleable per file, session-scoped like Writing Mode itself.
_Avoid_: caret centering, center scrolling, auto-scroll

**Paragraph Focus**:
An optional Writing Mode enhancement that dims every paragraph except the one holding the caret; a paragraph is a blank-line-separated block. Toggleable per file, session-scoped like Writing Mode itself.
_Avoid_: focus dimming, sentence focus, highlight paragraph, dim mode

**Annotation**:
A thread attached to rendered Markdown content — either to a selected text range or to a whole block. Scoped to a file within a Registered Project and stored in SQLite, never written into the document itself. The human and agent clients both write notes into it; supports editing, deletion, and a Resolved state.
_Avoid_: comment, 评论, review note, margin note, footnote

**Anchor**:
The reference from an Annotation to document content: the selected text plus surrounding context excerpts, or a block's text plus heading path for whole-block annotations. Re-located by fuzzy matching when the document loads; never a bare line number.
_Avoid_: position, offset, 行号引用, location reference

**Outdated**:
The visible state of an Annotation whose Anchor no longer matches the document after edits. Kept and displayed with a badge rather than silently dropped or mispositioned.
_Avoid_: stale, orphan, broken, 失效批注

**Missing File**:
The state of an Annotation whose stored path no longer exists in its Registered Project, typically after the file was deleted or moved outside the app. The Annotation is retained in SQLite and stays reachable from the management panel; it is not Outdated because its Anchor cannot be evaluated without the file.
_Avoid_: orphan, orphaned row, path-orphaned, orphaned annotation

**Reply**:
A note appended to an Annotation's thread after its first note, ordered by time. The thread is the human↔agent exchange surface: each Reply carries its own Authorship, so the two voices are distinguishable turn by turn.
_Avoid_: response, follow-up comment, message

**Author**:
The free-text name attached to every note in an Annotation thread: the logged-in username for web writes, or a name supplied by an agent client. Each note also carries an Agent flag, so a thread distinguishes the human's voice from an agent's independently of the name. Authorship is advisory, not an identity system — any client may claim any name, and legacy notes with no Author display "—". List endpoints can filter by Author. See `docs/adr/0007-reply-authorship.md`.
_Avoid_: owner, account, user identity, 作者

**Authorship**:
The advisory pairing of an Author name with the Agent flag on one note: who claimed the note and whether it was an agent's voice. The two belong together — a name alone cannot say which voice wrote the note. A blank or missing name reads as a legacy note. See `docs/adr/0007-reply-authorship.md`.
_Avoid_: author info, author identity, note owner, 署名

**Resolved**:
The state of an Annotation thread marked as dealt with. Applies to the whole thread, never to individual Replies. Resolved annotations keep their highlights in a dimmed style and can be filtered out in the annotation column.
_Avoid_: done, closed, finished, 已完成

**Tool Session**:
A non-expiring credential for non-interactive clients, such as the annotation CLI. Created by exchanging the instance username and password exactly once; the plaintext token is returned once and only its SHA-256 hash is stored in SQLite. Clients authenticate with `Authorization: Bearer <token>` across `/api/*` alongside the browser cookie. Tool Sessions survive server restarts and are invalidated only by manual deletion in the settings panel. See `docs/adr/0008-tool-sessions.md`.
_Avoid_: API key, permanent token, 永久令牌, bearer session
