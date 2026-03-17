import { Component, createSignal, createEffect, Show } from 'solid-js';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Settings {
  markdownWidth: 'full' | 'fixed';
  fixedWidth: string;
  theme: 'light' | 'dark';
}

const defaultSettings: Settings = {
  markdownWidth: 'full',
  fixedWidth: '900px',
  theme: 'light',
};

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
  const [settings, setSettings] = createSignal<Settings>(defaultSettings);
  const [saved, setSaved] = createSignal(false);

  createEffect(() => {
    // 从 localStorage 加载设置
    const saved = localStorage.getItem('openmkview-settings');
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  });

  const handleSave = () => {
    localStorage.setItem('openmkview-settings', JSON.stringify(settings()));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // 应用主题
    if (settings().theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Show when={props.isOpen}>
      <div class="settings-overlay" onClick={props.onClose}>
        <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div class="settings-panel-header">
            <h3>⚙️ Settings</h3>
            <button class="close-btn" onClick={props.onClose}>✕</button>
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

              <div class="settings-item">
                <label>Theme</label>
                <select
                  value={settings().theme}
                  onChange={(e) => updateSetting('theme', e.currentTarget.value as any)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
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
