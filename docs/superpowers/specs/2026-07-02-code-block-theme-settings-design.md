# Code Block Theme Settings Design

## Summary

Add user-configurable code block color scheme options to the settings panel. Currently, code highlighting uses hardcoded GitHub Light/Dark themes via Shiki. This feature allows users to select from multiple Shiki themes for code blocks.

## Requirements

### User Requirements

- Users want to personalize code block appearance beyond default GitHub themes
- Settings should be discoverable in the existing settings panel
- Code theme should automatically switch when UI theme mode changes (light/dark/system)

### Functional Requirements

1. Add "Code Theme (Light)" and "Code Theme (Dark)" dropdowns in Themes section
2. Offer multiple Shiki themes per mode
3. Persist settings to localStorage (client) and SQLite (server)
4. Dynamically apply selected theme when highlighting code

### Non-Functional Requirements

- No performance impact on code highlighting (themes loaded at startup)
- Settings sync between client and server
- Graceful fallback if theme fails to load

## Design Decisions

### Decision 1: Settings Location

**Chosen:** Themes section (after UI theme dropdowns)

**Alternatives considered:**
- A: Inside Fonts section - code font and theme together
- B: New dedicated "Code" section - all code settings grouped
- C: Themes section - all visual/theme settings together ✓

**Rationale:** Consistent with UI theme pattern, all visual customizations in one section, easier to discover.

### Decision 2: Theme Behavior

**Chosen:** Separate light/dark settings (automatic switching)

**Alternatives considered:**
- A: Separate light/dark - matches UI theme UX ✓
- B: Single theme setting - simpler but can clash with UI mode

**Rationale:** Users expect code to match their UI mode. Automatic switching provides consistent experience.

### Decision 3: Theme Selection

**Chosen:** GitHub (default) + 8 additional themes

**Light themes:** github-light, vitesse-light, min-light, solarized-light
**Dark themes:** github-dark, vitesse-dark, min-dark, one-dark-pro, nord, dracula, solarized-dark, monokai, slack

**Rationale:** Covers popular styles from minimal to vibrant. GitHub remains default for familiarity.

## Architecture

### Backend Changes

**File:** `src/models/settings.rs`
- Add `code_block_theme_light: String` field (default: "github-light")
- Add `code_block_theme_dark: String` field (default: "github-dark")

**File:** `src/db/repositories/settings_repo.rs`
- Add columns to SQLite schema migration
- Read/write code theme settings

**File:** `src/handlers/settings_handler.rs`
- No changes needed (already handles SystemSettings JSON)

### Frontend Changes

**File:** `frontend/src/types/app.ts`
- Add `codeBlockThemeLight` and `codeBlockThemeDark` to Settings interface
- Add to DEFAULT_SETTINGS

**File:** `frontend/src/utils/settings.ts`
- Add to extractServerSettings and mergeServerSettings
- Add applyCodeThemeSettings function

**File:** `frontend/src/components/SettingsPanel.tsx`
- Add dropdowns in Themes section
- Add theme options arrays

**File:** `frontend/src/services/shikiService.ts`
- Replace hardcoded LIGHT_THEME/DARK_THEME constants
- Load additional Shiki theme modules
- Use settingsStore to get current theme

**File:** `frontend/src/workers/shikiWorker.ts`
- Update to support dynamic themes
- Load all required themes at startup

### Data Flow

```
SettingsPanel (user selects)
    → settingsStore.updateSettings()
    → localStorage + /api/settings PUT
    → SQLite persistence

shikiService.highlightCode()
    → settingsStore.settings().codeBlockThemeLight/Dark
    → highlighter.codeToHtml(code, { theme })
```

## UI Design

### Settings Panel Layout

```
Themes Section
├── Theme Mode: [Follow System | Always Light | Always Dark]
├── Light Theme: [light-default | custom-light-1 | ...]
├── Dark Theme: [dark-default | custom-dark-1 | ...]
├── Code Theme (Light): [github-light | vitesse-light | min-light | solarized-light]
├── Code Theme (Dark): [github-dark | vitesse-dark | ... | slack]
└── Install Custom Theme: [file input]
```

### Theme Dropdown Options

Light:
- GitHub Light (default)
- Vitesse Light
- Min Light
- Solarized Light

Dark:
- GitHub Dark (default)
- Vitesse Dark
- Min Dark
- One Dark Pro
- Nord
- Dracula
- Solarized Dark
- Monokai
- Slack

## Error Handling

- If selected theme not loaded, fall back to GitHub default
- Log theme load failures, continue with available themes
- Invalid settings values reset to defaults on load

## Testing

- Settings persistence roundtrip (client → server → client)
- Theme switching with UI mode change
- Code highlighting with each theme
- Settings panel dropdown rendering

## Migration

- Existing users get GitHub defaults (no breaking change)
- SQLite migration adds new columns with default values
- localStorage merge preserves existing settings