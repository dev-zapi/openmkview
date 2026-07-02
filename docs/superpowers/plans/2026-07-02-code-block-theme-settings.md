# Code Block Theme Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-configurable code block color scheme settings with separate light/dark theme options.

**Architecture:** Extend existing settings system with two new fields. Shiki service dynamically applies selected themes. Settings panel adds dropdowns in Themes section.

**Tech Stack:** Rust (rusqlite), TypeScript (SolidJS), Shiki highlighting library

---

## File Structure

**Backend (Rust):**
- `src/models/settings.rs` - Add codeBlockThemeLight/Dark fields
- `src/db/repositories/settings_repo.rs` - SQLite migration + read/write
- `src/db/connection.rs` - Schema version bump (if needed)

**Frontend (TypeScript):**
- `frontend/src/types/app.ts` - Add to Settings interface + defaults
- `frontend/src/utils/settings.ts` - Add to extractServerSettings, mergeServerSettings
- `frontend/src/components/SettingsPanel.tsx` - Add dropdowns in Themes section
- `frontend/src/services/shikiService.ts` - Load themes, use settings
- `frontend/src/workers/shikiWorker.ts` - Update for dynamic themes

---

### Task 1: Backend Settings Model

**Files:**
- Modify: `src/models/settings.rs`
- Test: `src/models/settings.rs` (inline tests if needed)

- [ ] **Step 1: Add new fields to SystemSettings struct**

```rust
// Add after code_font_size field
#[serde(rename = "codeBlockThemeLight", default = "default_code_theme_light")]
pub code_block_theme_light: String,

#[serde(rename = "codeBlockThemeDark", default = "default_code_theme_dark")]
pub code_block_theme_dark: String,
```

- [ ] **Step 2: Add default functions**

```rust
fn default_code_theme_light() -> String {
    "github-light".to_string()
}

fn default_code_theme_dark() -> String {
    "github-dark".to_string()
}
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check`
Expected: No errors, fields added correctly

- [ ] **Step 4: Commit**

```bash
git add src/models/settings.rs
git commit -m "feat: add code block theme fields to settings model"
```

---

### Task 2: Backend Database Migration

**Files:**
- Modify: `src/db/repositories/settings_repo.rs`
- Modify: `src/db/connection.rs`

- [ ] **Step 1: Check current schema version**

Read `src/db/connection.rs` to find SCHEMA_VERSION constant. If version is N, bump to N+1.

- [ ] **Step 2: Add migration in connection.rs**

In the `migrations` array, add new migration:

```rust
// After the last migration entry
if version < N+1 {
    conn.execute(
        "ALTER TABLE settings ADD COLUMN code_block_theme_light TEXT DEFAULT 'github-light'",
        [],
    )?;
    conn.execute(
        "ALTER TABLE settings ADD COLUMN code_block_theme_dark TEXT DEFAULT 'github-dark'",
        [],
    )?;
    version = N+1;
}
```

- [ ] **Step 3: Update settings_repo.rs read function**

In `get_system_settings()`, add fields to the query and struct construction:

```rust
// Add to SELECT query
code_block_theme_light,
code_block_theme_dark

// Add to struct construction
code_block_theme_light: row.get::<_, String>(idx)?,
code_block_theme_dark: row.get::<_, String>(idx+1)?,
```

- [ ] **Step 4: Update settings_repo.rs save function**

In `save_system_settings()`, add fields to INSERT/UPDATE:

```rust
// Add to INSERT query columns
code_block_theme_light,
code_block_theme_dark

// Add to VALUES
?,
?

// Add to parameters
params.push(settings.code_block_theme_light.clone());
params.push(settings.code_block_theme_dark.clone());
```

- [ ] **Step 5: Run cargo test**

Run: `cargo test`
Expected: All tests pass, no database errors

- [ ] **Step 6: Commit**

```bash
git add src/db/connection.rs src/db/repositories/settings_repo.rs
git commit -m "feat: add database migration for code theme settings"
```

---

### Task 3: Frontend Settings Type

**Files:**
- Modify: `frontend/src/types/app.ts`

- [ ] **Step 1: Add fields to Settings interface**

In `Settings` interface, add after `sessionTimeoutMinutes`:

```typescript
codeBlockThemeLight: string;
codeBlockThemeDark: string;
```

- [ ] **Step 2: Add to ServerSettings interface**

In `ServerSettings` interface, add:

```typescript
codeBlockThemeLight: string;
codeBlockThemeDark: string;
```

- [ ] **Step 3: Add defaults to DEFAULT_SETTINGS**

```typescript
codeBlockThemeLight: 'github-light',
codeBlockThemeDark: 'github-dark',
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/app.ts
git commit -m "feat: add code theme fields to frontend settings type"
```

---

### Task 4: Frontend Settings Utils

**Files:**
- Modify: `frontend/src/utils/settings.ts`

- [ ] **Step 1: Add to extractServerSettings**

```typescript
codeBlockThemeLight: settings.codeBlockThemeLight,
codeBlockThemeDark: settings.codeBlockThemeDark,
```

- [ ] **Step 2: Add to mergeServerSettings**

The merge already spreads server into current, so no changes needed - fields merge automatically.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/settings.ts
git commit -m "feat: add code theme to server settings extraction"
```

---

### Task 5: Shiki Service Theme Loading

**Files:**
- Modify: `frontend/src/services/shikiService.ts`
- Modify: `frontend/src/workers/shikiWorker.ts`

- [ ] **Step 1: Import additional Shiki themes**

In `shikiService.ts`, replace the themes import array:

```typescript
themes: [
  // Light themes
  import('shiki/themes/github-light.mjs'),
  import('shiki/themes/vitesse-light.mjs'),
  import('shiki/themes/min-light.mjs'),
  import('shiki/themes/solarized-light.mjs'),
  // Dark themes
  import('shiki/themes/github-dark.mjs'),
  import('shiki/themes/vitesse-dark.mjs'),
  import('shiki/themes/min-dark.mjs'),
  import('shiki/themes/one-dark-pro.mjs'),
  import('shiki/themes/nord.mjs'),
  import('shiki/themes/dracula.mjs'),
  import('shiki/themes/solarized-dark.mjs'),
  import('shiki/themes/monokai.mjs'),
  import('shiki/themes/slack-dark.mjs'),
],
```

- [ ] **Step 2: Remove hardcoded constants, add theme map**

```typescript
// Remove LIGHT_THEME and DARK_THEME constants

// Add theme name mapping (Shiki uses different names for some)
const THEME_MAP: Record<string, string> = {
  'github-light': 'github-light',
  'github-dark': 'github-dark',
  'vitesse-light': 'vitesse-light',
  'vitesse-dark': 'vitesse-dark',
  'min-light': 'min-light',
  'min-dark': 'min-dark',
  'solarized-light': 'solarized-light',
  'solarized-dark': 'solarized-dark',
  'one-dark-pro': 'one-dark-pro',
  'nord': 'nord',
  'dracula': 'dracula',
  'monokai': 'monokai',
  'slack': 'slack-dark',
};
```

- [ ] **Step 3: Import settingsStore and update highlightCode**

```typescript
import { settingsStore } from '../stores/settingsStore';

export async function highlightCode(options: HighlightOptions): Promise<HighlightResult> {
  const highlighter = await getHighlighter();
  
  // Determine which theme to use based on mode and settings
  const effectiveThemeType = settingsStore.effectiveTheme;
  const themeSetting = effectiveThemeType === 'dark' 
    ? settingsStore.settings().codeBlockThemeDark 
    : settingsStore.settings().codeBlockThemeLight;
  
  // Map to Shiki theme name, fallback to github
  const theme = THEME_MAP[themeSetting] || (effectiveThemeType === 'dark' ? 'github-dark' : 'github-light');
  
  // Override with options.theme if explicitly provided
  const useTheme = options.theme 
    ? THEME_MAP[options.theme === 'dark' ? settingsStore.settings().codeBlockThemeDark : settingsStore.settings().codeBlockThemeLight] || (options.theme === 'dark' ? 'github-dark' : 'github-light')
    : theme;
  
  let lang = options.lang.toLowerCase();
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    lang = 'text';
  }

  const html = highlighter.codeToHtml(options.code, {
    lang,
    theme: useTheme,
  });

  return { html };
}
```

- [ ] **Step 4: Update highlightCodeWithTransformers similarly**

```typescript
export async function highlightCodeWithTransformers(
  code: string,
  lang: string,
  theme: 'light' | 'dark',
  transformers: any[] = []
): Promise<string> {
  const highlighter = await getHighlighter();
  
  const themeSetting = theme === 'dark' 
    ? settingsStore.settings().codeBlockThemeDark 
    : settingsStore.settings().codeBlockThemeLight;
  const themeName = THEME_MAP[themeSetting] || (theme === 'dark' ? 'github-dark' : 'github-light');

  let normalizedLang = lang.toLowerCase();
  if (!highlighter.getLoadedLanguages().includes(normalizedLang)) {
    normalizedLang = 'text';
  }

  return highlighter.codeToHtml(code, {
    lang: normalizedLang,
    theme: themeName,
    transformers,
  });
}
```

- [ ] **Step 5: Update shikiWorker.ts similarly**

In `shikiWorker.ts`:
1. Import the same themes array
2. Add THEME_MAP constant
3. Update highlight logic to use theme from request

```typescript
// In initHighlighter(), update themes array
themes: [
  // Light themes (same as service)
  import('shiki/themes/github-light.mjs'),
  import('shiki/themes/vitesse-light.mjs'),
  import('shiki/themes/min-light.mjs'),
  import('shiki/themes/solarized-light.mjs'),
  // Dark themes (same as service)
  import('shiki/themes/github-dark.mjs'),
  import('shiki/themes/vitesse-dark.mjs'),
  import('shiki/themes/min-dark.mjs'),
  import('shiki/themes/one-dark-pro.mjs'),
  import('shiki/themes/nord.mjs'),
  import('shiki/themes/dracula.mjs'),
  import('shiki/themes/solarized-dark.mjs'),
  import('shiki/themes/monokai.mjs'),
  import('shiki/themes/slack-dark.mjs'),
],

// Add THEME_MAP
const THEME_MAP: Record<string, string> = {
  'github-light': 'github-light',
  'github-dark': 'github-dark',
  'vitesse-light': 'vitesse-light',
  'vitesse-dark': 'vitesse-dark',
  'min-light': 'min-light',
  'min-dark': 'min-dark',
  'solarized-light': 'solarized-light',
  'solarized-dark': 'solarized-dark',
  'one-dark-pro': 'one-dark-pro',
  'nord': 'nord',
  'dracula': 'dracula',
  'monokai': 'monokai',
  'slack': 'slack-dark',
};

// Update highlight logic
const themeName = THEME_MAP[request.codeTheme] || (request.theme === 'dark' ? DARK_THEME : LIGHT_THEME);
```

- [ ] **Step 6: Update worker request type**

```typescript
interface HighlightRequest {
  type: 'highlight';
  code: string;
  lang: string;
  theme: 'light' | 'dark';
  codeTheme: string; // Add this field
}
```

- [ ] **Step 7: Update worker client**

In `shikiWorkerClient.ts`, update request to include codeTheme:

```typescript
interface HighlightRequest {
  type: 'highlight';
  code: string;
  lang: string;
  theme: 'light' | 'dark';
  codeTheme: string;
}

export async function highlightCodeWorker(options: HighlightOptions): Promise<HighlightResult> {
  // ...
  const request: HighlightRequest = {
    type: 'highlight',
    code: options.code,
    lang: options.lang,
    theme: options.theme || 'light',
    codeTheme: options.codeTheme || (options.theme === 'dark' ? 'github-dark' : 'github-light'),
  };
  // ...
}
```

- [ ] **Step 8: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, no type errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/shikiService.ts frontend/src/workers/shikiWorker.ts frontend/src/services/shikiWorkerClient.ts
git commit -m "feat: load multiple shiki themes and use settings"
```

---

### Task 6: Settings Panel Dropdowns

**Files:**
- Modify: `frontend/src/components/SettingsPanel.tsx`

- [ ] **Step 1: Add theme options arrays**

After the font presets arrays, add:

```typescript
const codeThemeLightPresets: PresetOption[] = [
  { label: 'GitHub Light', value: 'github-light' },
  { label: 'Vitesse Light', value: 'vitesse-light' },
  { label: 'Min Light', value: 'min-light' },
  { label: 'Solarized Light', value: 'solarized-light' },
];

const codeThemeDarkPresets: PresetOption[] = [
  { label: 'GitHub Dark', value: 'github-dark' },
  { label: 'Vitesse Dark', value: 'vitesse-dark' },
  { label: 'Min Dark', value: 'min-dark' },
  { label: 'One Dark Pro', value: 'one-dark-pro' },
  { label: 'Nord', value: 'nord' },
  { label: 'Dracula', value: 'dracula' },
  { label: 'Solarized Dark', value: 'solarized-dark' },
  { label: 'Monokai', value: 'monokai' },
  { label: 'Slack', value: 'slack' },
];
```

- [ ] **Step 2: Add dropdowns in Themes section**

After the dark-theme dropdown, add:

```tsx
<div class="settings-item">
  <label for="code-theme-light">Code Theme (Light)</label>
  <select
    id="code-theme-light"
    value={settingsStore.settings().codeBlockThemeLight}
    onChange={(e) => updateSetting('codeBlockThemeLight', e.currentTarget.value)}
  >
    <For each={codeThemeLightPresets}>
      {(theme) => <option value={theme.value}>{theme.label}</option>}
    </For>
  </select>
</div>

<div class="settings-item">
  <label for="code-theme-dark">Code Theme (Dark)</label>
  <select
    id="code-theme-dark"
    value={settingsStore.settings().codeBlockThemeDark}
    onChange={(e) => updateSetting('codeBlockThemeDark', e.currentTarget.value)}
  >
    <For each={codeThemeDarkPresets}>
      {(theme) => <option value={theme.value}>{theme.label}</option>}
    </For>
  </select>
</div>
```

- [ ] **Step 3: Run frontend typecheck**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SettingsPanel.tsx
git commit -m "feat: add code theme dropdowns to settings panel"
```

---

### Task 7: Integration Test

**Files:**
- Test: Manual testing in browser

- [ ] **Step 1: Run full application**

Run: `cargo run`
Expected: Server starts on http://localhost:8080

- [ ] **Step 2: Open settings panel in browser**

Navigate to http://localhost:8080, click Settings icon, verify:
- Themes section shows "Code Theme (Light)" dropdown
- Themes section shows "Code Theme (Dark)" dropdown
- Dropdowns have all expected options

- [ ] **Step 3: Test theme switching**

1. Select "Vitesse Light" for light mode
2. Select "One Dark Pro" for dark mode
3. Click Save Settings
4. Reload page
5. Verify settings persisted

- [ ] **Step 4: Test code highlighting**

1. Open a markdown file with code blocks
2. Toggle theme mode (light → dark → light)
3. Verify code block colors change with theme
4. Verify selected themes are applied (Vitesse light, One Dark Pro dark)

- [ ] **Step 5: Test defaults**

1. Clear localStorage
2. Reload page
3. Verify code theme defaults to GitHub Light/Dark
4. Open settings, verify dropdowns show GitHub as selected

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: complete code block theme settings implementation"
```

---

### Task 8: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add feature to README**

In the features section, add:

```markdown
- **Customizable code themes** — Choose from 13 Shiki themes for code block highlighting (GitHub, Vitesse, One Dark Pro, Nord, Dracula, Solarized, Monokai, Min, Slack)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document code theme customization feature"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✓ Settings location (Themes section) - Task 6
- ✓ Separate light/dark settings - Task 1, 3, 6
- ✓ Theme options (13 themes) - Task 5, 6
- ✓ Backend persistence - Task 1, 2
- ✓ Frontend integration - Task 3, 4, 5, 6
- ✓ Testing - Task 7

**Placeholder scan:**
- No TBD/TODO found
- All code blocks contain actual implementations
- All commands specified

**Type consistency:**
- Backend: code_block_theme_light/dark (snake_case, serde rename)
- Frontend: codeBlockThemeLight/Dark (camelCase)
- THEME_MAP keys match frontend values
- All consistent ✓