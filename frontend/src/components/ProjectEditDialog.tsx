import { Component, createSignal, Show, For } from 'solid-js';
import type { Project } from '../types';

interface ProjectEditDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
}

const PRESET_COLORS = [
  '#9333ea', // purple
  '#00897b', // teal
  '#e65100', // orange
  '#7b1fa2', // deep purple
  '#1976d2', // blue
  '#388e3c', // green
  '#c2185b', // pink
  '#5d4037', // brown
];

const PRESET_ICONS = [
  '📁', '📂', '📄', '📝', '️', '📑', '📚', '',
  '💼', '🎯', '⭐', '🌟', '💡', '🔥', '🚀', '💻',
  '🎨', '🎬', '🎵', '', '📱', '⚙️', '🔧', '🔨',
  '📊', '📈', '📉', '💳', '💰', '💵', '', '🎁',
];

const ProjectEditDialog: Component<ProjectEditDialogProps> = (props) => {
  const [name, setName] = createSignal(props.project.name);
  const [color, setColor] = createSignal(props.project.color);
  const [icon, setIcon] = createSignal(props.project.icon);
  const [customColor, setCustomColor] = createSignal('#000000');
  const [showCustomColor, setShowCustomColor] = createSignal(false);

  const handleSave = () => {
    props.onSave({
      ...props.project,
      name: name(),
      color: color(),
      icon: icon(),
    });
    props.onClose();
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowCustomColor(false);
  };

  const handleCustomColorChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    setCustomColor(target.value);
    setColor(target.value);
  };

  const handleIconSelect = (selectedIcon: string) => {
    setIcon(selectedIcon);
  };

  const isCustomColor = () => {
    return color() && !PRESET_COLORS.includes(color()!);
  };

  return (
    <Show when={props.isOpen}>
      <div class="dialog-overlay" onClick={props.onClose}>
        <div class="dialog-content" onClick={(e) => e.stopPropagation()}>
          <div class="dialog-header">
            <h3>Edit project</h3>
            <button class="dialog-close" onClick={props.onClose}>×</button>
          </div>

          <div class="dialog-body">
            <div class="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="form-input"
                placeholder="Project name"
              />
            </div>

            <div class="form-group">
              <label>Icon</label>
              <div class="icon-preview-container">
                <div 
                  class="icon-preview-large"
                  style={{ background: color() || 'var(--color-bg-subtle)' }}
                >
                  <span class="icon-preview-letter">
                    {icon() || name().charAt(0).toUpperCase() || 'P'}
                  </span>
                </div>
                <div class="icon-picker-inline">
                  <div class="icon-grid">
                    <For each={PRESET_ICONS}>
                      {(iconItem) => (
                        <button
                          class={`icon-grid-item ${icon() === iconItem ? 'active' : ''}`}
                          onClick={() => handleIconSelect(iconItem)}
                          title={iconItem}
                        >
                          {iconItem}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Color</label>
              <div class="color-picker-inline">
                <For each={PRESET_COLORS}>
                  {(colorItem) => (
                    <button
                      class={`color-swatch ${color() === colorItem ? 'active' : ''}`}
                      style={{ background: colorItem }}
                      onClick={() => handleColorSelect(colorItem)}
                    >
                      <Show when={color() === colorItem}>
                        <span class="color-check">✓</span>
                      </Show>
                    </button>
                  )}
                </For>
                <button
                  class={`color-swatch custom-color ${isCustomColor() ? 'active' : ''}`}
                  style={{ background: isCustomColor() ? color() : 'var(--color-bg-subtle)' }}
                  onClick={() => setShowCustomColor(!showCustomColor())}
                  title="Custom color"
                >
                  <Show when={!isCustomColor()} fallback={<span class="color-check">✓</span>}>
                    <span class="custom-color-icon">+</span>
                  </Show>
                </button>
              </div>
              <Show when={showCustomColor()}>
                <div class="custom-color-input-container">
                  <input
                    type="color"
                    value={color() || customColor()}
                    onInput={handleCustomColorChange}
                    class="color-input-native"
                  />
                  <input
                    type="text"
                    value={color() || ''}
                    onInput={(e) => setColor(e.currentTarget.value)}
                    class="color-input-text"
                    placeholder="#000000"
                  />
                </div>
              </Show>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="dialog-button cancel" onClick={props.onClose}>
              Cancel
            </button>
            <button class="dialog-button save" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ProjectEditDialog;
