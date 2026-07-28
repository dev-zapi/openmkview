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
