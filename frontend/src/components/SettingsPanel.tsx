import { Component, createSignal, createEffect, Show, onMount, For } from 'solid-js';
import type { ThemeMode, ThemeType, Theme, Settings } from '../App';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const defaultSettings: Settings = {
  markdownWidth: 'full',
  fixedWidth: '900px',
  themeMode: 'system',
  lightTheme: 'light-default',
  darkTheme: 'dark-default',
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  uiFontSize: '14px',
  markdownFontSize: '16px',
  protectedPaths: ['.git', '.github', '.svn', '.hg', 'node_modules', 'target', 'dist', 'build'],
  trashExpireDays: 30,
};

const getSystemTheme = (): ThemeType => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getEffectiveThemeType = (mode: ThemeMode): ThemeType => {
  return mode === 'system' ? getSystemTheme() : mode;
};

const applyTheme = (settings: Settings) => {
  const effectiveType = getEffectiveThemeType(settings.themeMode);
  const themeId = effectiveType === 'light' ? settings.lightTheme : settings.darkTheme;
  
  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(`${effectiveType}-theme`, themeId);
};

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
  const [settings, setSettings] = createSignal<Settings>(defaultSettings);
  const [saved, setSaved] = createSignal(false);
  const [themes, setThemes] = createSignal<Theme[]>([]);
  const [installing, setInstalling] = createSignal(false);
  const [installError, setInstallError] = createSignal<string | null>(null);

  const loadThemes = async () => {
    try {
      const response = await fetch('/api/themes');
      const data = await response.json();
      setThemes(data.themes);
    } catch (e) {
      console.error('Failed to load themes:', e);
    }
  };

  onMount(() => {
    loadThemes();
  });

  createEffect(() => {
    const savedSettings = localStorage.getItem('openmkview-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ 
          ...defaultSettings, 
          ...parsed,
          themeMode: parsed.themeMode || parsed.theme || 'system',
          lightTheme: parsed.lightTheme || 'light-default',
          darkTheme: parsed.darkTheme || 'dark-default',
        });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  });

  const handleSave = () => {
    localStorage.setItem('openmkview-settings', JSON.stringify(settings()));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    applyTheme(settings());
    props.onSave?.();
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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

  const lightThemes = () => themes().filter(t => t.type === 'light');
  const darkThemes = () => themes().filter(t => t.type === 'dark');

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

          <div class="settings-panel-content">
            <div class="settings-section">
              <h4>Themes</h4>

              <div class="settings-item">
                <label>Theme Mode</label>
                <select
                  value={settings().themeMode}
                  onChange={(e) => updateSetting('themeMode', e.currentTarget.value as ThemeMode)}
                >
                  <option value="system">Follow System</option>
                  <option value="light">Always Light</option>
                  <option value="dark">Always Dark</option>
                </select>
              </div>

              <div class="settings-item">
                <label>Light Theme</label>
                <select
                  value={settings().lightTheme}
                  onChange={(e) => updateSetting('lightTheme', e.currentTarget.value)}
                >
                  <For each={lightThemes()}>
                    {(theme) => <option value={theme.id}>{theme.name}{!theme.builtin ? ' (Custom)' : ''}</option>}
                  </For>
                </select>
              </div>

              <div class="settings-item">
                <label>Dark Theme</label>
                <select
                  value={settings().darkTheme}
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

            <div class="settings-section">
              <h4>Markdown</h4>

              <div class="settings-item">
                <label>Content Width</label>
                <select
                  value={settings().markdownWidth}
                  onChange={(e) => updateSetting('markdownWidth', e.currentTarget.value as any)}
                >
                  <option value="full">Full Width</option>
                  <option value="fixed">Fixed Width</option>
                </select>
              </div>

              <Show when={settings().markdownWidth === 'fixed'}>
                <div class="settings-item">
                  <label>Fixed Width Value</label>
                  <input
                    type="text"
                    value={settings().fixedWidth}
                    onInput={(e) => updateSetting('fixedWidth', e.currentTarget.value)}
                    placeholder="e.g., 900px, 70%"
                  />
                </div>
              </Show>
            </div>

            <div class="settings-section">
              <h4>Trash Settings</h4>

              <div class="settings-item">
                <label>Auto-delete after (days)</label>
                <input
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
                <label>Protected Paths (cannot be deleted)</label>
                <textarea
                  value={settings().protectedPaths.join('\n')}
                  onInput={(e) => updateSetting('protectedPaths', e.currentTarget.value.split('\n').filter(p => p.trim()))}
                  placeholder=".git\n.github\nnode_modules"
                  rows={5}
                />
                <p style="margin-top: 4px; color: var(--color-text); font-size: 11px; opacity: 0.7;">
                  Files/folders matching these paths cannot be moved to trash.
                </p>
              </div>
            </div>

            <div class="settings-section">
              <h4>Font Settings</h4>

              <div class="settings-item">
                <label>UI Font</label>
                <input
                  type="text"
                  value={settings().uiFontFamily}
                  onInput={(e) => updateSetting('uiFontFamily', e.currentTarget.value)}
                  placeholder="e.g., MiSans, sans-serif"
                />
                <div class="font-presets">
                  <button onClick={() => updateSetting('uiFontFamily', 'MiSans, sans-serif')}>System Default</button>
                  <button onClick={() => updateSetting('uiFontFamily', '"Segoe UI", Roboto, sans-serif')}>Segoe UI</button>
                  <button onClick={() => updateSetting('uiFontFamily', '"Helvetica Neue", Arial, sans-serif')}>Helvetica</button>
                  <button onClick={() => updateSetting('uiFontFamily', '"Noto Sans SC", "PingFang SC", sans-serif')}>Chinese Sans</button>
                  <button onClick={() => updateSetting('uiFontFamily', '"JetBrains Mono", monospace')}>Monospace</button>
                </div>
              </div>

              <div class="settings-item">
                <label>UI Font Size</label>
                <input
                  type="text"
                  value={settings().uiFontSize}
                  onInput={(e) => updateSetting('uiFontSize', e.currentTarget.value)}
                  placeholder="e.g., 14px"
                />
                <div class="size-presets">
                  <button onClick={() => updateSetting('uiFontSize', '12px')}>12px</button>
                  <button onClick={() => updateSetting('uiFontSize', '14px')}>14px</button>
                  <button onClick={() => updateSetting('uiFontSize', '16px')}>16px</button>
                  <button onClick={() => updateSetting('uiFontSize', '18px')}>18px</button>
                  <button onClick={() => updateSetting('uiFontSize', '20px')}>20px</button>
                </div>
              </div>

              <div class="settings-item">
                <label>Markdown Font</label>
                <input
                  type="text"
                  value={settings().markdownFontFamily}
                  onInput={(e) => updateSetting('markdownFontFamily', e.currentTarget.value)}
                  placeholder="e.g., Georgia, serif"
                />
                <div class="font-presets">
                  <button onClick={() => updateSetting('markdownFontFamily', 'Georgia, "Noto Serif", serif')}>Georgia</button>
                  <button onClick={() => updateSetting('markdownFontFamily', '"Noto Sans SC", "PingFang SC", sans-serif')}>Chinese Sans</button>
                  <button onClick={() => updateSetting('markdownFontFamily', '"Noto Serif SC", "Songti SC", serif')}>Chinese Serif</button>
                  <button onClick={() => updateSetting('markdownFontFamily', '"JetBrains Mono", monospace')}>Monospace</button>
                </div>
              </div>

              <div class="settings-item">
                <label>Markdown Font Size</label>
                <input
                  type="text"
                  value={settings().markdownFontSize}
                  onInput={(e) => updateSetting('markdownFontSize', e.currentTarget.value)}
                  placeholder="e.g., 16px"
                />
                <div class="size-presets">
                  <button onClick={() => updateSetting('markdownFontSize', '14px')}>14px</button>
                  <button onClick={() => updateSetting('markdownFontSize', '16px')}>16px</button>
                  <button onClick={() => updateSetting('markdownFontSize', '18px')}>18px</button>
                  <button onClick={() => updateSetting('markdownFontSize', '20px')}>20px</button>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-panel-footer">
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