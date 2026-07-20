# Unified Storage Paths with AppPaths Injection

OpenMKView previously had scattered path resolution logic across modules, each calling `dirs::data_local_dir()` or `dirs::config_dir()` independently. We decided to unify all paths under two roots (Config Root and Data Root) encapsulated in an `AppPaths` struct injected via `web::Data<AppPaths>`.

**Decision:** All storage paths derive from two base directories:
- **Config Root** (`OPENMKVIEW_CONFIG_HOME`): `config.toml`, `themes/`
- **Data Root** (`OPENMKVIEW_DATA_HOME`): `openmkview.db`, `trash/`, `passkeys.json`

The `AppPaths` struct is constructed once in `main.rs` (reading env vars or using XDG defaults) and injected into services. Tests construct their own `AppPaths` with `tempdir()`, eliminating `#[cfg(test)]` branches and ensuring full isolation from production data.

**Considered Options:**
- Global `OnceLock<AppPaths>` — rejected because hidden dependencies make testing harder
- Environment variables only (no struct) — rejected because scattered logic is hard to reason about
- Single unified root — rejected because config (user-editable) and data (runtime state) have different semantics

**Consequences:**
- `OPENMKVIEW_DB_PATH` is deprecated in favor of `OPENMKVIEW_DATA_HOME` (which implies the DB path as `<data_dir>/openmkview.db`)
- No migration needed: XDG defaults already match current behavior
- All `#[cfg(test)]` path branches are removed; tests explicitly construct `AppPaths`
- Services must accept `AppPaths` in constructors, requiring signature changes
