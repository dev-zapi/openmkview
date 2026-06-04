# Version Display in Settings Modal

## Overview

Add application version display (with git commit hash) to the bottom of the settings modal.

## Requirements

- Display format: `v0.2.0-abc1234` (version + short git hash)
- Position: Bottom of settings modal, left side of footer
- No authentication required (public endpoint)

## Architecture

### Backend

**New handler: `src/handlers/version_handler.rs`**
- Returns static JSON response: `{ "version": "v0.2.0-abc1234" }`
- Uses build-time environment variables:
  - `CARGO_PKG_VERSION` from Cargo.toml
  - `GIT_SHORT_HASH` from build.rs
- No database or AppState dependency
- Simple synchronous handler

**Route registration: `src/main.rs`**
- Add route: `/api/version` → GET → `get_version`
- Position after `/api/settings` routes

### Frontend

**SettingsPanel.tsx changes:**
- Add state: `const [version, setVersion] = createSignal<string>("")`
- Fetch version on mount (extend existing `onMount` hook)
- Display in footer section before save button

**index.css changes:**
- Style `.settings-version`: small font (12px), muted color (opacity 0.7)
- Modify `.settings-panel-footer`: use `justify-content: space-between` to align version left, save button right

## Implementation Steps

1. Create `src/handlers/version_handler.rs`
2. Export handler in `src/handlers/mod.rs`
3. Add route in `src/main.rs` configure_routes function
4. Add version fetch and display in `SettingsPanel.tsx`
5. Add CSS styling in `index.css`

## Testing

- Verify `/api/version` endpoint returns correct format
- Test version display in settings modal (open/close)
- Test responsive layout (footer spacing)