import { Component, createSignal, createEffect, createMemo, Show, onMount, onCleanup, For } from 'solid-js';
import type { JSX } from 'solid-js';
import type { ThemeMode, Theme, Settings, PasskeyCredentialSummary, WritingFontFamily } from '../types/app';
import { applyTheme } from '../utils/theme';
import { CUSTOM_STYLESHEET_MAX, resolvedEditorFontSize, resolvedWritingFontSize } from '../utils/settings';
import { authStore } from '../stores/authStore';
import { settingsStore } from '../stores/settingsStore';
import { CssEditor } from './CssEditor';
import { Button, Input, Select, TagListInput } from './ui';
import { forceRefreshApp, type ForceRefreshStatus } from '../services/pwaRefresh';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  authRequired?: boolean;
}

interface SettingsCategory {
  id: string;
  label: string;
}

interface PresetOption {
  label: string;
  value: string;
}

type StringSettingKey = {
  [K in keyof Settings]: Settings[K] extends string ? K : never
}[keyof Settings];

const categories: SettingsCategory[] = [
  { id: 'settings-themes', label: 'Themes' },
  { id: 'settings-markdown', label: 'Markdown' },
  { id: 'settings-file-tree', label: 'File Tree' },
  { id: 'settings-session', label: 'Session' },
  { id: 'settings-passkeys', label: 'Passkeys' },
  { id: 'settings-trash', label: 'Trash' },
  { id: 'settings-fonts', label: 'Fonts' },
  { id: 'settings-about', label: 'About' },
];

const uiFontPresets: PresetOption[] = [
  { label: 'System Default', value: 'MiSans, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Roboto, sans-serif' },
  { label: 'Helvetica', value: '"Helvetica Neue", Arial, sans-serif' },
  { label: 'Chinese Sans', value: '"Noto Sans SC", "PingFang SC", sans-serif' },
  { label: 'Monospace', value: '"JetBrains Mono", monospace' },
];

const markdownFontPresets: PresetOption[] = [
  { label: 'Georgia', value: 'Georgia, "Noto Serif", serif' },
  { label: 'Chinese Sans', value: '"Noto Sans SC", "PingFang SC", sans-serif' },
  { label: 'Chinese Serif', value: '"Noto Serif SC", "Songti SC", serif' },
  { label: 'Monospace', value: '"JetBrains Mono", monospace' },
];

const codeFontPresets: PresetOption[] = [
  { label: 'JetBrains Mono', value: '"JetBrains Mono", ui-monospace, Consolas, monospace' },
  { label: 'Fira Code', value: '"Fira Code", "JetBrains Mono", monospace' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Monospace', value: 'monospace' },
];

const uiFontSizePresets: PresetOption[] = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
];

const markdownFontSizePresets: PresetOption[] = [
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
];

const fontSizePresets: PresetOption[] = [
  { label: '12px', value: '12px' },
  { label: '13px', value: '13px' },
  { label: '14px', value: '14px' },
  { label: '15px', value: '15px' },
  { label: '16px', value: '16px' },
];

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

// Mirrors get_builtin_themes() in src/models/theme.rs; keeps the pickers
// functional when /api/themes fails so Settings never becomes a dead button.
const FALLBACK_THEMES: Theme[] = [
  { id: 'light-default', name: 'Default', type: 'light', builtin: true },
  { id: 'light-warm', name: 'Warm', type: 'light', builtin: true },
  { id: 'light-cool', name: 'Cool', type: 'light', builtin: true },
  { id: 'dark-default', name: 'Default', type: 'dark', builtin: true },
  { id: 'dark-blue', name: 'Blue', type: 'dark', builtin: true },
  { id: 'dark-purple', name: 'Purple', type: 'dark', builtin: true },
];

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
  const [saved, setSaved] = createSignal(false);
  const [themes, setThemes] = createSignal<Theme[]>([]);
  const [themesError, setThemesError] = createSignal(false);
  const [installing, setInstalling] = createSignal(false);
  const [installError, setInstallError] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [passkeys, setPasskeys] = createSignal<PasskeyCredentialSummary[]>([]);
  const [passkeyLoading, setPasskeyLoading] = createSignal(false);
  const [passkeyBusyId, setPasskeyBusyId] = createSignal<string | null>(null);
  const [passkeyError, setPasskeyError] = createSignal<string | null>(null);
  const [activeCategory, setActiveCategory] = createSignal(categories[0].id);
  const [version, setVersion] = createSignal<string>("");
  const [refreshStatus, setRefreshStatus] = createSignal<ForceRefreshStatus | null>(null);
  const settings = createMemo(() => settingsStore.settings());
  let observer: IntersectionObserver | null = null;
  let observerTimer: number | undefined;
  let contentRef: HTMLDivElement | undefined;
  const visibleCategories = () => categories.filter((category) => {
    if (!props.authRequired) {
      return category.id !== 'settings-session' && category.id !== 'settings-passkeys';
    }

    return true;
  });
  const scrollToCategory = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveCategory(id);
    }
  };

  const initObserver = () => {
    if (!contentRef) return;
    if (typeof window.IntersectionObserver === 'undefined') return;
    
    observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries[0]) {
          setActiveCategory(visibleEntries[0].target.id);
        }
      },
      {
        root: contentRef,
        threshold: 0.3,
        rootMargin: '0px 0px -60% 0px',
      }
    );

    visibleCategories().forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer?.observe(el);
    });
  };

  onMount(() => {
    void loadThemes();
    void loadPasskeys();
    void loadVersion();
  });

  createEffect(() => {
    if (props.isOpen) {
      setActiveCategory(visibleCategories()[0]?.id ?? categories[0].id);
      observer?.disconnect();
      observerTimer = window.setTimeout(() => initObserver(), 0);
    } else {
      if (observerTimer) {
        clearTimeout(observerTimer);
        observerTimer = undefined;
      }
      observer?.disconnect();
      observer = null;
    }
  });

  onCleanup(() => {
    if (observerTimer) {
      clearTimeout(observerTimer);
    }
    observer?.disconnect();
  });

  const loadThemes = async () => {
    setThemesError(false);
    try {
      const response = await fetch('/api/themes');
      const data = await response.json();
      // An error body ({ error: ... }) or a failed proxy has no themes array;
      // setting undefined here used to crash themes().filter below.
      if (!response.ok || !Array.isArray(data?.themes)) {
        throw new Error(`Themes unavailable (HTTP ${response.status})`);
      }
      setThemes(data.themes);
    } catch (e) {
      console.error('Failed to load themes:', e);
      setThemes(FALLBACK_THEMES);
      setThemesError(true);
    }
  };

  const loadPasskeys = async () => {
    if (!props.authRequired) {
      setPasskeys([]);
      return;
    }

    if (!authStore.passkeyConfigured()) {
      setPasskeys([]);
      setPasskeyError(null);
      setPasskeyLoading(false);
      return;
    }

    setPasskeyLoading(true);
    setPasskeyError(null);

    try {
      const credentials = await authStore.listPasskeys();
      setPasskeys(credentials);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Failed to load Passkeys');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const loadVersion = async () => {
    try {
      const response = await fetch('/api/version');
      const data = await response.json();
      setVersion(data.version);
    } catch (e) {
      console.error('Failed to load version:', e);
    }
  };

  createEffect(() => {
    if (props.isOpen && props.authRequired) {
      void loadPasskeys();
    }
  });

  const handleSave = () => {
    void (async () => {
      setSaveError(null);
      try {
        await settingsStore.saveServerSettings(settings());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        applyTheme(settings());
        props.onSave?.();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
      }
    })();
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    settingsStore.updateSettings({ [key]: value });
  };

  const handleThemeInstall = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setInstalling(true);
    setInstallError(null);

    try {
      const content = await file.text();
      const response = await fetch('/api/themes/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to install theme');
      }

      await loadThemes();
      input.value = '';
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Failed to install theme');
    } finally {
      setInstalling(false);
    }
  };

  const handlePasskeyRegister = async () => {
    if (!authStore.passkeyConfigured()) {
      return;
    }

    const suggested = `Device ${passkeys().length + 1}`;
    const name = window.prompt('Passkey name', suggested) || undefined;
    setPasskeyBusyId('__register__');
    setPasskeyError(null);

    try {
      const credentials = await authStore.registerPasskey(name);
      setPasskeys(credentials);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Failed to register Passkey');
    } finally {
      setPasskeyBusyId(null);
    }
  };

  const handlePasskeyDelete = async (id: string) => {
    setPasskeyBusyId(id);
    setPasskeyError(null);

    try {
      const credentials = await authStore.deletePasskey(id);
      setPasskeys(credentials);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Failed to delete Passkey');
    } finally {
      setPasskeyBusyId(null);
    }
  };

  const formatTimestamp = (value?: string) => {
    if (!value) {
      return 'Never used';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const buildTimeLabel = () => {
    const stamp = import.meta.env.VITE_FRONTEND_BUILD_TIME;
    if (!stamp) {
      return 'unknown';
    }
    const date = new Date(stamp);
    return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
  };

  const handleForceRefresh = () => {
    if (refreshStatus()) {
      return;
    }
    void forceRefreshApp(setRefreshStatus);
  };

  const refreshLabel = () => {
    switch (refreshStatus()) {
      case 'checking':
        return 'Checking…';
      case 'updating':
        return 'Refreshing…';
      case 'reloading':
        return 'Reloading…';
      default:
        return 'Force refresh app';
    }
  };

  const lightThemes = () => themes().filter(t => t.type === 'light');
  const darkThemes = () => themes().filter(t => t.type === 'dark');
  const passkeyStatusText = () => {
    if (!authStore.passkeyConfigured()) {
      return 'Passkey is not configured for this domain.';
    }

    if (!authStore.passkeyAvailable()) {
      return 'Passkey is configured for this domain, but no Passkeys are registered yet.';
    }

    return 'Passkey is available for this domain.';
  };

  const renderPresetButtons = <K extends StringSettingKey>(
    key: K,
    presets: PresetOption[],
    className: string,
    trailing?: JSX.Element
  ) => {
    return (
      <div class={className}>
        <For each={presets}>
          {(preset) => (
            <Button type="button" variant="outline" size="sm" onClick={() => updateSetting(key, preset.value as Settings[K])}>
              {preset.label}
            </Button>
          )}
        </For>
        {trailing}
      </div>
    );
  };

  return (
    <Show when={props.isOpen}>
      <div class="settings-overlay" onClick={props.onClose}>
        <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div class="settings-panel-header">
            <h3>Settings</h3>
            <Button
              variant="ghost"
              size="icon"
              class="close-btn"
              onClick={props.onClose}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </Button>
          </div>

          <div class="settings-panel-body">
            <nav class="settings-nav">
              <ul>
                <For each={visibleCategories()}>
                  {(cat) => (
                    <li>
                      <button
                        type="button"
                        class={activeCategory() === cat.id ? 'active' : ''}
                        onClick={() => scrollToCategory(cat.id)}
                        aria-current={activeCategory() === cat.id ? 'true' : undefined}
                      >
                        {cat.label}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </nav>

            <div class="settings-panel-content" ref={contentRef}>
              <Show when={saveError()}>
                <p style="margin-bottom: 16px; color: var(--color-error); font-size: 12px;">{saveError()}</p>
              </Show>

              <div class="settings-section" id="settings-themes">
                <h4>Themes</h4>

                <Show when={themesError()}>
                  <p class="settings-load-error">
                    <span>Couldn't load the theme list — showing built-in themes.</span>
                    <button type="button" class="settings-retry" onClick={() => void loadThemes()}>
                      Retry
                    </button>
                  </p>
                </Show>

                <div class="settings-item">
                  <label for="theme-mode">Theme Mode</label>
                  <Select
                    id="theme-mode"
                    value={settings().themeMode}
                    onChange={(e) => updateSetting('themeMode', e.currentTarget.value as ThemeMode)}
                  >
                    <option value="system">Follow System</option>
                    <option value="light">Always Light</option>
                    <option value="dark">Always Dark</option>
                  </Select>
                </div>

                <div class="settings-item">
                  <label for="light-theme">Light Theme</label>
                  <Select
                    id="light-theme"
                    value={settings().lightTheme}
                    onChange={(e) => updateSetting('lightTheme', e.currentTarget.value)}
                  >
                    <For each={lightThemes()}>
                      {(theme) => <option value={theme.id}>{theme.name}{!theme.builtin ? ' (Custom)' : ''}</option>}
                    </For>
                  </Select>
                </div>

                <div class="settings-item">
                  <label for="dark-theme">Dark Theme</label>
                  <Select
                    id="dark-theme"
                    value={settings().darkTheme}
                    onChange={(e) => updateSetting('darkTheme', e.currentTarget.value)}
                  >
                    <For each={darkThemes()}>
                      {(theme) => <option value={theme.id}>{theme.name}{!theme.builtin ? ' (Custom)' : ''}</option>}
                    </For>
                  </Select>
                </div>

                <div class="settings-item">
                  <label for="code-theme-light">Code Theme (Light)</label>
                  <Select
                    id="code-theme-light"
                    value={settings().codeBlockThemeLight}
                    onChange={(e) => updateSetting('codeBlockThemeLight', e.currentTarget.value)}
                  >
                    <For each={codeThemeLightPresets}>
                      {(theme) => <option value={theme.value}>{theme.label}</option>}
                    </For>
                  </Select>
                </div>

                <div class="settings-item">
                  <label for="code-theme-dark">Code Theme (Dark)</label>
                  <Select
                    id="code-theme-dark"
                    value={settings().codeBlockThemeDark}
                    onChange={(e) => updateSetting('codeBlockThemeDark', e.currentTarget.value)}
                  >
                    <For each={codeThemeDarkPresets}>
                      {(theme) => <option value={theme.value}>{theme.label}</option>}
                    </For>
                  </Select>
                </div>

                <div class="settings-item">
                  <label>Install Custom Theme</label>
                  <input
                    type="file"
                    accept=".theme.css"
                    onChange={handleThemeInstall}
                    disabled={installing()}
                  />
                  <Show when={installing()}>
                    <p style="margin-top: 8px; color: var(--color-text); font-size: 12px;">Installing...</p>
                  </Show>
                  <Show when={installError()}>
                    <p style="margin-top: 8px; color: var(--color-error); font-size: 12px;">{installError()}</p>
                  </Show>
                  <p style="margin-top: 8px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Theme files should have .theme.css extension with @name and @type metadata comments.
                  </p>
                </div>
              </div>

              <div class="settings-section" id="settings-markdown">
                <h4>Markdown</h4>

                <div class="settings-item">
                  <label for="content-width">Content Width</label>
                  <Select
                    id="content-width"
                    value={settings().markdownWidth.mode}
                    onChange={(e) => updateSetting('markdownWidth', { ...settings().markdownWidth, mode: e.currentTarget.value as 'full' | 'fixed' })}
                  >
                    <option value="full">Full Width</option>
                    <option value="fixed">Fixed Width</option>
                  </Select>
                </div>

                <Show when={settings().markdownWidth.mode === 'fixed'}>
                  <div class="settings-item">
                    <label for="fixed-width-value">Fixed Width Value</label>
                    <Input
                      id="fixed-width-value"
                      type="text"
                      value={settings().markdownWidth.fixedWidth}
                      onInput={(e) => updateSetting('markdownWidth', { ...settings().markdownWidth, fixedWidth: e.currentTarget.value })}
                      placeholder="e.g., 900px, 70%"
                    />
                  </div>
                </Show>

                <div class="settings-item">
                  <label for="table-density">Table Density</label>
                  <Select
                    id="table-density"
                    value={settings().tableDensity}
                    onChange={(e) => updateSetting('tableDensity', e.currentTarget.value as 'small' | 'medium' | 'large')}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </Select>
                </div>

                <div class="settings-item">
                  <label for="table-wrap">Table Cell Wrapping</label>
                  <Select
                    id="table-wrap"
                    value={settings().tableWrap}
                    onChange={(e) => updateSetting('tableWrap', e.currentTarget.value as 'wrap' | 'nowrap')}
                  >
                    <option value="wrap">Wrap</option>
                    <option value="nowrap">No wrap (scroll horizontally)</option>
                  </Select>
                </div>

                <div class="settings-item settings-item-column">
                  <label for="custom-stylesheet">Custom Stylesheet</label>
                  <CssEditor
                    value={settings().customStylesheet}
                    onChange={(v) => updateSetting('customStylesheet', v.slice(0, CUSTOM_STYLESHEET_MAX))}
                    theme={settingsStore.effectiveTheme}
                  />
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; gap: 8px;">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateSetting('customStylesheet', '')}
                    >
                      Clear
                    </Button>
                    <span style="font-size: 11px; color: var(--color-text); opacity: 0.7;">
                      {settings().customStylesheet.length} / {CUSTOM_STYLESHEET_MAX}
                    </span>
                  </div>
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Scoped to the Markdown content. Write element selectors directly (e.g. <code>table</code>, <code>h1</code>). To override built-in styles, raise specificity with <code>:scope</code> (e.g. <code>:scope td {'{'} padding: 4px {'}'}</code>). Dark mode: <code>:scope[data-theme='dark'] {'{'} ... {'}'}</code>. External <code>url()</code>/<code>@import</code> won't work offline. Requires a modern browser (CSS @scope).
                  </p>
                </div>
              </div>

              <div class="settings-section" id="settings-file-tree">
                <h4>File Tree</h4>

                <div class="settings-item">
                  <label for="ignored-files">Ignored Files (never shown)</label>
                  <TagListInput
                    id="ignored-files"
                    values={settings().ignoredFiles}
                    onChange={(values) => updateSetting('ignoredFiles', values)}
                    placeholder="e.g. .DS_Store"
                    addLabel="Ignored file"
                  />
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Files matching these names never appear in the file tree, regardless of the hidden toggle.
                  </p>
                </div>

                <div class="settings-item">
                  <label for="placeholder-dirs">Placeholder Directories (not expandable)</label>
                  <TagListInput
                    id="placeholder-dirs"
                    values={settings().placeholderDirs}
                    onChange={(values) => updateSetting('placeholderDirs', values)}
                    placeholder="e.g. node_modules"
                    addLabel="Placeholder directory"
                  />
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    These directories stay visible but cannot be expanded, and they cannot be deleted.
                  </p>
                </div>
              </div>

              <Show when={props.authRequired}>
                <div class="settings-section" id="settings-session">
                  <h4>Session</h4>

                  <div class="settings-item">
                    <label for="session-timeout-minutes">Session Timeout (minutes)</label>
                    <Input
                      id="session-timeout-minutes"
                      type="number"
                      min="1"
                      max="10080"
                      value={settings().sessionTimeoutMinutes}
                      onInput={(e) => updateSetting('sessionTimeoutMinutes', parseInt(e.currentTarget.value, 10) || 60)}
                    />
                    <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                      Controls how long inactive sessions remain valid. Login credentials can only be changed by CLI, env, or config file.
                    </p>
                  </div>
                </div>
              </Show>

              <Show when={props.authRequired}>
                <div class="settings-section" id="settings-passkeys">
                  <h4>Passkeys</h4>

                  <div class="settings-item">
                    <label>Passkeys for Current Site</label>
                    <p style="margin-top: 4px; margin-bottom: 12px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                      Register a Passkey on this device or a security key, then use it as an alternative to password login for the current domain.
                    </p>
                    <p style="margin-top: 4px; margin-bottom: 8px; color: var(--color-text); font-size: 12px; opacity: 0.85;">
                      {passkeyStatusText()}
                    </p>
                    <Show when={authStore.passkeyOrigin()}>
                      <p style="margin-top: 0; margin-bottom: 12px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                        Current site: {authStore.passkeyOrigin()}
                      </p>
                    </Show>

                    <Show when={passkeyError()}>
                      <p style="margin-bottom: 12px; color: var(--color-error); font-size: 12px;">{passkeyError()}</p>
                    </Show>

                    <div class="passkey-list">
                      <Show when={passkeyLoading()}>
                        <div class="passkey-empty">Loading Passkeys...</div>
                      </Show>

                      <Show when={!passkeyLoading() && !authStore.passkeyConfigured()}>
                        <div class="passkey-empty">Passkey is not enabled for this domain.</div>
                      </Show>

                      <Show when={!passkeyLoading() && authStore.passkeyConfigured() && passkeys().length === 0}>
                        <div class="passkey-empty">No Passkeys registered yet.</div>
                      </Show>

                      <For each={passkeys()}>
                        {(credential) => (
                          <div class="passkey-card">
                            <div class="passkey-card-meta">
                              <div class="passkey-card-name">{credential.name}</div>
                              <div class="passkey-card-time">Created {formatTimestamp(credential.createdAt)}</div>
                              <div class="passkey-card-time">Last used {formatTimestamp(credential.lastUsedAt)}</div>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              class="passkey-delete-btn"
                              disabled={passkeyBusyId() === credential.id}
                              onClick={() => void handlePasskeyDelete(credential.id)}
                            >
                              <Show when={passkeyBusyId() === credential.id}>
                                <span class="btn-spinner" aria-hidden="true" />
                              </Show>
                              {passkeyBusyId() === credential.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </div>
                        )}
                      </For>
                    </div>

                    <Button
                      type="button"
                      variant="default"
                      class="passkey-register-btn"
                      disabled={passkeyBusyId() === '__register__' || !authStore.passkeyConfigured()}
                      onClick={() => void handlePasskeyRegister()}
                    >
                      <Show when={passkeyBusyId() === '__register__'}>
                        <span class="btn-spinner" aria-hidden="true" />
                      </Show>
                      {passkeyBusyId() === '__register__'
                        ? 'Waiting for Passkey...'
                        : authStore.passkeyConfigured()
                          ? 'Add Passkey for This Domain'
                          : 'Passkey Unavailable for This Domain'}
                    </Button>
                  </div>
                </div>
              </Show>

              <div class="settings-section" id="settings-trash">
                <h4>Trash Settings</h4>

                <div class="settings-item">
                  <label for="trash-expire-days">Auto-delete after (days)</label>
                  <Input
                    id="trash-expire-days"
                    type="number"
                    min="1"
                    max="365"
                    value={settings().trashExpireDays}
                    onInput={(e) => updateSetting('trashExpireDays', parseInt(e.currentTarget.value) || 30)}
                  />
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Items in trash older than this will be automatically deleted on app startup.
                  </p>
                </div>

                <div class="settings-item">
                  <label for="protected-paths">Protected Paths (cannot be deleted)</label>
                  <TagListInput
                    id="protected-paths"
                    values={settings().protectedPaths}
                    onChange={(values) => updateSetting('protectedPaths', values)}
                    placeholder="e.g. .github"
                    addLabel="Protected path"
                  />
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Files/folders matching these paths cannot be moved to trash. Placeholder directories are protected automatically.
                  </p>
                </div>
              </div>

              <div class="settings-section" id="settings-fonts">
                <h4>Font Settings</h4>

                <div class="settings-item">
                  <label for="ui-font-family">UI Font</label>
                  <Input
                    id="ui-font-family"
                    type="text"
                    value={settings().uiFontFamily}
                    onInput={(e) => updateSetting('uiFontFamily', e.currentTarget.value)}
                    placeholder="e.g., MiSans, sans-serif"
                  />
                  {renderPresetButtons('uiFontFamily', uiFontPresets, 'font-presets')}
                </div>

                <div class="settings-item">
                  <label for="ui-font-size">UI Font Size</label>
                  <Input
                    id="ui-font-size"
                    type="text"
                    value={settings().uiFontSize}
                    onInput={(e) => updateSetting('uiFontSize', e.currentTarget.value)}
                    placeholder="e.g., 14px"
                  />
                  {renderPresetButtons('uiFontSize', uiFontSizePresets, 'size-presets')}
                </div>

                <div class="settings-item">
                  <label for="markdown-font-family">Markdown Font</label>
                  <Input
                    id="markdown-font-family"
                    type="text"
                    value={settings().markdownFontFamily}
                    onInput={(e) => updateSetting('markdownFontFamily', e.currentTarget.value)}
                    placeholder="e.g., Georgia, serif"
                  />
                  {renderPresetButtons('markdownFontFamily', markdownFontPresets, 'font-presets')}
                </div>

                <div class="settings-item">
                  <label for="markdown-font-size">Markdown Font Size</label>
                  <Input
                    id="markdown-font-size"
                    type="text"
                    value={settings().markdownFontSize}
                    onInput={(e) => updateSetting('markdownFontSize', e.currentTarget.value)}
                    placeholder="e.g., 16px"
                  />
                  {renderPresetButtons('markdownFontSize', markdownFontSizePresets, 'size-presets')}
                </div>

                <div class="settings-item">
                  <label for="code-font-family">Code Block Font</label>
                  <Input
                    id="code-font-family"
                    type="text"
                    value={settings().codeFontFamily}
                    onInput={(e) => updateSetting('codeFontFamily', e.currentTarget.value)}
                    placeholder="e.g., JetBrains Mono, monospace"
                  />
                  {renderPresetButtons('codeFontFamily', codeFontPresets, 'font-presets')}
                </div>

                <div class="settings-item">
                  <label for="code-font-size">Code Block Font Size</label>
                  <Input
                    id="code-font-size"
                    type="text"
                    value={settings().codeFontSize}
                    onInput={(e) => updateSetting('codeFontSize', e.currentTarget.value)}
                    placeholder="e.g., 14px"
                  />
                  {renderPresetButtons('codeFontSize', fontSizePresets, 'size-presets')}
                </div>

                <div class="settings-item">
                  <label for="editor-font-size">Editor Font Size</label>
                  <Input
                    id="editor-font-size"
                    type="text"
                    value={settings().editorFontSize}
                    onInput={(e) => updateSetting('editorFontSize', e.currentTarget.value)}
                    placeholder={`Follows Code Block Font Size (currently ${resolvedEditorFontSize(settings())})`}
                  />
                  {renderPresetButtons('editorFontSize', fontSizePresets, 'size-presets',
                    <Button type="button" variant="outline" size="sm" onClick={() => updateSetting('editorFontSize', '')}>
                      Follow
                    </Button>
                  )}
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Leave empty to follow Code Block Font Size
                  </p>
                </div>

                <div class="settings-item">
                  <label for="writing-font-family">Writing Font Family</label>
                  <Select
                    id="writing-font-family"
                    value={settings().writingFontFamily}
                    onChange={(e) => updateSetting('writingFontFamily', e.currentTarget.value as WritingFontFamily)}
                  >
                    <option value="serif">Serif</option>
                    <option value="sans">Sans</option>
                    <option value="system">Follow System</option>
                  </Select>
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Serif and Sans presets include CJK fallbacks.
                  </p>
                </div>

                <div class="settings-item">
                  <label for="writing-font-size">Writing Font Size</label>
                  <Input
                    id="writing-font-size"
                    type="text"
                    value={settings().writingFontSize}
                    onInput={(e) => updateSetting('writingFontSize', e.currentTarget.value)}
                    placeholder={`Follows Editor Font Size (currently ${resolvedWritingFontSize(settings())})`}
                  />
                  {renderPresetButtons('writingFontSize', fontSizePresets, 'size-presets',
                    <Button type="button" variant="outline" size="sm" onClick={() => updateSetting('writingFontSize', '')}>
                      Follow
                    </Button>
                  )}
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Leave empty to follow Editor Font Size, then Code Block Font Size
                  </p>
                </div>

                <div class="settings-item">
                  <label for="writing-column-width">Writing Column Width</label>
                  <Select
                    id="writing-column-width"
                    value={settings().writingWidth.mode}
                    onChange={(e) => updateSetting('writingWidth', { ...settings().writingWidth, mode: e.currentTarget.value as 'full' | 'fixed' })}
                  >
                    <option value="fixed">Fixed Width</option>
                    <option value="full">Full Width</option>
                  </Select>
                </div>

                <Show when={settings().writingWidth.mode === 'fixed'}>
                  <div class="settings-item">
                    <label for="writing-fixed-width-value">Writing Column Width Value</label>
                    <Input
                      id="writing-fixed-width-value"
                      type="text"
                      value={settings().writingWidth.fixedWidth}
                      onInput={(e) => updateSetting('writingWidth', { ...settings().writingWidth, fixedWidth: e.currentTarget.value })}
                      placeholder="e.g., 65ch, 900px"
                    />
                    <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                      Default 65ch keeps a readable line length.
                    </p>
                  </div>
                </Show>
              </div>

              <div class="settings-section" id="settings-about">
                <h4>About</h4>

                <div class="settings-about-card">
                  <div class="settings-about-header">
                    <span class="settings-about-version">{version() || 'Unknown version'}</span>
                    <span class="settings-about-build">Build Time: {buildTimeLabel()}</span>
                  </div>
                  <p class="settings-about-description">
                    Refreshing clears cached app files and loads the newest version. Unsaved settings changes will be lost.
                  </p>
                  <Button
                    type="button"
                    class="settings-about-refresh"
                    disabled={refreshStatus() !== null}
                    onClick={handleForceRefresh}
                  >
                    <Show when={refreshStatus() !== null}>
                      <span class="btn-spinner" aria-hidden="true" />
                    </Show>
                    {refreshLabel()}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-panel-footer">
            <Show when={version()}>
              <div class="settings-version-info">
                <span class="settings-version">{version()}</span>
                <span class="settings-build-time">Build Time: {buildTimeLabel()}</span>
              </div>
            </Show>
            <Button class="settings-save-btn" onClick={handleSave}>
              <Show when={saved()}>
                <span class="save-check" aria-hidden="true">✓</span>
              </Show>
              {saved() ? ' Saved!' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default SettingsPanel;
