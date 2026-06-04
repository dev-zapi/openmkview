# Version Display in Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add application version (with git commit hash) display to the bottom of the settings modal.

**Architecture:** Backend provides `/api/version` endpoint returning `v{version}-{commit}` format. Frontend fetches on mount and displays in settings panel footer.

**Tech Stack:** Rust (Actix-web, serde), SolidJS, CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/handlers/version_handler.rs` | Create | Version endpoint handler |
| `src/handlers/mod.rs` | Modify | Export version handler |
| `src/main.rs` | Modify | Register `/api/version` route |
| `frontend/src/components/SettingsPanel.tsx` | Modify | Fetch and display version |
| `frontend/src/index.css` | Modify | Style version display in footer |

---

### Task 1: Create Version Handler

**Files:**
- Create: `src/handlers/version_handler.rs`

- [ ] **Step 1: Create version handler file**

```rust
use crate::errors::AppResult;
use actix_web::{web, HttpResponse};
use serde::Serialize;

#[derive(Serialize)]
struct VersionResponse {
    version: String,
}

pub async fn get_version() -> AppResult<HttpResponse> {
    let version = env!("CARGO_PKG_VERSION");
    let git_hash = env!("GIT_SHORT_HASH");
    let full_version = format!("v{}-{}", version, git_hash);
    
    Ok(HttpResponse::Ok().json(VersionResponse { version: full_version }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/handlers/version_handler.rs
git commit -m "feat: add version handler endpoint"
```

---

### Task 2: Export Version Handler

**Files:**
- Modify: `src/handlers/mod.rs`

- [ ] **Step 1: Add version_handler module and export**

Add at the end of the module declarations (after `mod trash_handler;`):

```rust
mod version_handler;
```

Add at the end of the exports (after trash exports):

```rust
pub use version_handler::get_version;
```

Full modified file should look like:

```rust
mod auth_handler;
mod file_handler;
mod git_handler;
mod passkey_handler;
mod project_handler;
mod settings_handler;
mod theme_handler;
mod trash_handler;
mod version_handler;

pub use auth_handler::{auth_login, auth_logout, auth_status, auth_update_session_timeout};
pub use file_handler::{
    create_file, delete_file, get_file_content, get_file_tree, rename_file, save_file_content,
    search_favicons, serve_project_file,
};
pub use git_handler::{
    execute_git, get_branches, get_commits, get_file_at_ref, get_file_diff, get_tags,
};
pub use passkey_handler::{
    passkey_delete, passkey_list, passkey_login_finish, passkey_login_start,
    passkey_register_finish, passkey_register_start,
};
pub use project_handler::{
    close_project, create_project, get_recent_projects, list_projects, open_project, resolve_path,
    update_project, update_project_color, validate_project,
};
pub use settings_handler::{get_settings, update_settings};
pub use theme_handler::{
    delete_custom_theme, get_theme_css_content, install_custom_theme, list_themes,
};
pub use trash_handler::{
    clear_trash, delete_from_trash, get_trash_stats, list_trash, move_to_trash, restore_from_trash,
};
pub use version_handler::get_version;
```

- [ ] **Step 2: Commit**

```bash
git add src/handlers/mod.rs
git commit -m "feat: export version handler from handlers module"
```

---

### Task 3: Register Version Route

**Files:**
- Modify: `src/main.rs:176-177`

- [ ] **Step 1: Add route in configure_routes function**

Find the line with `.route("/api/settings", web::put().to(update_settings))` and add the version route after it:

```rust
.route("/api/settings", web::get().to(get_settings))
.route("/api/settings", web::put().to(update_settings))
.route("/api/version", web::get().to(get_version))
```

- [ ] **Step 2: Run cargo check to verify**

Run: `cargo check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main.rs
git commit -m "feat: add /api/version route"
```

---

### Task 4: Add Version Display in SettingsPanel

**Files:**
- Modify: `frontend/src/components/SettingsPanel.tsx`

- [ ] **Step 1: Add version state and fetch**

Find the state declarations section (around line 72-82). Add after `activeCategory` state:

```tsx
const [version, setVersion] = createSignal<string>("");
```

Add fetch in the existing `onMount` (around line 128-131). Modify `onMount` to:

```tsx
onMount(() => {
  void loadThemes();
  void loadPasskeys();
  void loadVersion();
});
```

Add the `loadVersion` function after `loadPasskeys` function (around line 189):

```tsx
const loadVersion = async () => {
  try {
    const response = await fetch('/api/version');
    const data = await response.json();
    setVersion(data.version);
  } catch (e) {
    console.error('Failed to load version:', e);
  }
};
```

- [ ] **Step 2: Add version display in footer**

Find the footer section (around line 665-669). Modify to:

```tsx
<div class="settings-panel-footer">
  <Show when={version()}>
    <span class="settings-version">{version()}</span>
  </Show>
  <button class="settings-save-btn" onClick={handleSave}>
    {saved() ? '✓ Saved!' : 'Save Settings'}
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SettingsPanel.tsx
git commit -m "feat: add version fetch and display in settings panel"
```

---

### Task 5: Style Version Display

**Files:**
- Modify: `frontend/src/index.css:1690-1695`

- [ ] **Step 1: Modify footer layout for space-between**

Find `.settings-panel-footer` (around line 1690-1695). Change `justify-content`:

```css
.settings-panel-footer {
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

- [ ] **Step 2: Add version styling**

Add new style rule after `.settings-panel-footer`:

```css
.settings-version {
  font-size: 12px;
  color: var(--color-text);
  opacity: 0.7;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: style version display in settings footer"
```

---

### Task 6: Verify Implementation

- [ ] **Step 1: Run cargo fmt and clippy**

Run: `cargo fmt && cargo clippy`
Expected: No warnings

- [ ] **Step 2: Build and run**

Run: `cargo run`
Wait for server to start, then verify:
- Open settings modal
- Check version appears at bottom left of footer
- Verify format is `v0.2.0-{hash}`

- [ ] **Step 3: Final commit if needed**

```bash
git status
# If any uncommitted changes:
git add . && git commit -m "chore: final cleanup for version display"
```