import { Component, createSignal, createEffect, Show } from 'solid-js';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface Settings {
  markdownWidth: 'full' | 'fixed';
  fixedWidth: string;
  theme: 'light' | 'dark' | 'system';
  // Font settings
  uiFontFamily: string;
  markdownFontFamily: string;
  uiFontSize: string;
  markdownFontSize: string;
}

const defaultSettings: Settings = {
  markdownWidth: 'full',
  fixedWidth: '900px',
  theme: 'system',
  // Font defaults
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  uiFontSize: '14px',
  markdownFontSize: '16px',
};

const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(`${effectiveTheme}-theme`);
};

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
  const [settings, setSettings] = createSignal<Settings>(defaultSettings);
  const [saved, setSaved] = createSignal(false);

  createEffect(() => {
    const savedSettings = localStorage.getItem('openmkview-settings');
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  });

  const handleSave = () => {
    localStorage.setItem('openmkview-settings', JSON.stringify(settings()));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    applyTheme(settings().theme);
    props.onSave?.();
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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

          <div class="settings-panel-content">
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
              <h4>Appearance</h4>
              {/* Theme toggle removed - now in Activity Bar */}
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
