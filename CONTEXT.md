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
