import { Component, createSignal, createEffect, Show, onMount, onCleanup, For } from 'solid-js';
import type { ThemeMode, Theme, Settings, PasskeyCredentialSummary } from '../types/app';
import { DEFAULT_SETTINGS } from '../types/app';
import { applyTheme } from '../utils/theme';
import { saveSettings } from '../utils/settings';
import { authStore } from '../stores/authStore';
import { settingsStore } from '../stores/settingsStore';

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
  { id: 'settings-session', label: 'Session' },
  { id: 'settings-passkeys', label: 'Passkeys' },
  { id: 'settings-trash', label: 'Trash' },
  { id: 'settings-fonts', label: 'Fonts' },
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

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
  const [saved, setSaved] = createSignal(false);
  const [themes, setThemes] = createSignal<Theme[]>([]);
  const [installing, setInstalling] = createSignal(false);
  const [installError, setInstallError] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [passkeys, setPasskeys] = createSignal<PasskeyCredentialSummary[]>([]);
  const [passkeyLoading, setPasskeyLoading] = createSignal(false);
  const [passkeyBusyId, setPasskeyBusyId] = createSignal<string | null>(null);
  const [passkeyError, setPasskeyError] = createSignal<string | null>(null);
  const [activeCategory, setActiveCategory] = createSignal(categories[0].id);
  const [version, setVersion] = createSignal<string>("");
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
    try {
      const response = await fetch('/api/themes');
      const data = await response.json();
      setThemes(data.themes);
    } catch (e) {
      console.error('Failed to load themes:', e);
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
        await settingsStore.saveServerSettings(settingsStore.settings());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        applyTheme(settingsStore.settings());
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
    className: string
  ) => {
    return (
      <div class={className}>
        <For each={presets}>
          {(preset) => (
            <button type="button" onClick={() => updateSetting(key, preset.value as Settings[K])}>
              {preset.label}
            </button>
          )}
        </For>
      </div>
    );
  };

  return (
    <Show when={props.isOpen}>
      <div class="settings-overlay" onClick={props.onClose}>
        <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div class="settings-panel-header">
            <h3>Settings</h3>
            <button class="close-btn" onClick={props.onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
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

                <div class="settings-item">
                  <label for="theme-mode">Theme Mode</label>
                  <select
                    id="theme-mode"
                    value={settingsStore.settings().themeMode}
                    onChange={(e) => updateSetting('themeMode', e.currentTarget.value as ThemeMode)}
                  >
                    <option value="system">Follow System</option>
                    <option value="light">Always Light</option>
                    <option value="dark">Always Dark</option>
                  </select>
                </div>

                <div class="settings-item">
                  <label for="light-theme">Light Theme</label>
                  <select
                    id="light-theme"
                    value={settingsStore.settings().lightTheme}
                    onChange={(e) => updateSetting('lightTheme', e.currentTarget.value)}
                  >
                    <For each={lightThemes()}>
                      {(theme) => <option value={theme.id}>{theme.name}{!theme.builtin ? ' (Custom)' : ''}</option>}
                    </For>
                  </select>
                </div>

                <div class="settings-item">
                  <label for="dark-theme">Dark Theme</label>
                  <select
                    id="dark-theme"
                    value={settingsStore.settings().darkTheme}
                    onChange={(e) => updateSetting('darkTheme', e.currentTarget.value)}
                  >
                    <For each={darkThemes()}>
                      {(theme) => <option value={theme.id}>{theme.name}{!theme.builtin ? ' (Custom)' : ''}</option>}
                    </For>
                  </select>
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
                  <select
                    id="content-width"
                    value={settingsStore.settings().markdownWidth.mode}
                    onChange={(e) => updateSetting('markdownWidth', { ...settingsStore.settings().markdownWidth, mode: e.currentTarget.value as 'full' | 'fixed' })}
                  >
                    <option value="full">Full Width</option>
                    <option value="fixed">Fixed Width</option>
                  </select>
                </div>

                <Show when={settingsStore.settings().markdownWidth.mode === 'fixed'}>
                  <div class="settings-item">
                    <label for="fixed-width-value">Fixed Width Value</label>
                    <input
                      id="fixed-width-value"
                      type="text"
                      value={settingsStore.settings().markdownWidth.fixedWidth}
                      onInput={(e) => updateSetting('markdownWidth', { ...settingsStore.settings().markdownWidth, fixedWidth: e.currentTarget.value })}
                      placeholder="e.g., 900px, 70%"
                    />
                  </div>
                </Show>
              </div>

              <Show when={props.authRequired}>
                <div class="settings-section" id="settings-session">
                  <h4>Session</h4>

                  <div class="settings-item">
                    <label for="session-timeout-minutes">Session Timeout (minutes)</label>
                    <input
                      id="session-timeout-minutes"
                      type="number"
                      min="1"
                      max="10080"
                      value={settingsStore.settings().sessionTimeoutMinutes}
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

                            <button
                              type="button"
                              class="passkey-delete-btn"
                              disabled={passkeyBusyId() === credential.id}
                              onClick={() => void handlePasskeyDelete(credential.id)}
                            >
                              {passkeyBusyId() === credential.id ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </For>
                    </div>

                    <button
                      type="button"
                      class="passkey-register-btn"
                      disabled={passkeyBusyId() === '__register__' || !authStore.passkeyConfigured()}
                      onClick={() => void handlePasskeyRegister()}
                    >
                      {passkeyBusyId() === '__register__'
                        ? 'Waiting for Passkey...'
                        : authStore.passkeyConfigured()
                          ? 'Add Passkey for This Domain'
                          : 'Passkey Unavailable for This Domain'}
                    </button>
                  </div>
                </div>
              </Show>

              <div class="settings-section" id="settings-trash">
                <h4>Trash Settings</h4>

                <div class="settings-item">
                  <label for="trash-expire-days">Auto-delete after (days)</label>
                  <input
                    id="trash-expire-days"
                    type="number"
                    min="1"
                    max="365"
                    value={settingsStore.settings().trashExpireDays}
                    onInput={(e) => updateSetting('trashExpireDays', parseInt(e.currentTarget.value) || 30)}
                  />
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Items in trash older than this will be automatically deleted on app startup.
                  </p>
                </div>

                <div class="settings-item">
                  <label for="protected-paths">Protected Paths (cannot be deleted)</label>
                  <textarea
                    id="protected-paths"
                    value={settingsStore.settings().protectedPaths.join('\n')}
                    onInput={(e) => updateSetting('protectedPaths', e.currentTarget.value.split('\n').filter(p => p.trim()))}
                    placeholder=".git\n.github\nnode_modules"
                    rows={5}
                  />
                  <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                    Files/folders matching these paths cannot be moved to trash.
                  </p>
                </div>
              </div>

              <div class="settings-section" id="settings-fonts">
                <h4>Font Settings</h4>

                <div class="settings-item">
                  <label for="ui-font-family">UI Font</label>
                  <input
                    id="ui-font-family"
                    type="text"
                    value={settingsStore.settings().uiFontFamily}
                    onInput={(e) => updateSetting('uiFontFamily', e.currentTarget.value)}
                    placeholder="e.g., MiSans, sans-serif"
                  />
                  {renderPresetButtons('uiFontFamily', uiFontPresets, 'font-presets')}
                </div>

                <div class="settings-item">
                  <label for="ui-font-size">UI Font Size</label>
                  <input
                    id="ui-font-size"
                    type="text"
                    value={settingsStore.settings().uiFontSize}
                    onInput={(e) => updateSetting('uiFontSize', e.currentTarget.value)}
                    placeholder="e.g., 14px"
                  />
                  {renderPresetButtons('uiFontSize', uiFontSizePresets, 'size-presets')}
                </div>

                <div class="settings-item">
                  <label for="markdown-font-family">Markdown Font</label>
                  <input
                    id="markdown-font-family"
                    type="text"
                    value={settingsStore.settings().markdownFontFamily}
                    onInput={(e) => updateSetting('markdownFontFamily', e.currentTarget.value)}
                    placeholder="e.g., Georgia, serif"
                  />
                  {renderPresetButtons('markdownFontFamily', markdownFontPresets, 'font-presets')}
                </div>

                <div class="settings-item">
                  <label for="markdown-font-size">Markdown Font Size</label>
                  <input
                    id="markdown-font-size"
                    type="text"
                    value={settingsStore.settings().markdownFontSize}
                    onInput={(e) => updateSetting('markdownFontSize', e.currentTarget.value)}
                    placeholder="e.g., 16px"
                  />
                  {renderPresetButtons('markdownFontSize', markdownFontSizePresets, 'size-presets')}
                </div>
              </div>
            </div>
          </div>

          <div class="settings-panel-footer">
            <Show when={version()}>
              <span class="settings-version">{version()}</span>
            </Show>
            <button class="settings-save-btn" onClick={handleSave}>
              {saved() ? '✓ Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default SettingsPanel;
