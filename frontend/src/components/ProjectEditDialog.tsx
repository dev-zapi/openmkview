import { Component, createSignal, Show, For, createEffect, onMount } from 'solid-js';
import type { Project } from '../types';
import { api } from '../services/api';

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

const FAVICON_PREFIX = 'favicon:';

const isFaviconIcon = (icon: string | null | undefined): boolean => {
  return icon?.startsWith(FAVICON_PREFIX) ?? false;
};

const getFaviconPath = (icon: string): string => {
  return icon.replace(FAVICON_PREFIX, '');
};

const ProjectEditDialog: Component<ProjectEditDialogProps> = (props) => {
  const [name, setName] = createSignal(props.project.name);
  const [color, setColor] = createSignal(props.project.color);
  const [icon, setIcon] = createSignal(props.project.icon);
  const [customColor, setCustomColor] = createSignal('#000000');
  const [showCustomColor, setShowCustomColor] = createSignal(false);
  const [favicons, setFavicons] = createSignal<string[]>([]);
  const [searchingFavicons, setSearchingFavicons] = createSignal(false);

  createEffect(() => {
    setName(props.project.name);
    setColor(props.project.color);
    setIcon(props.project.icon);
  });

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

  const handleFaviconSelect = (faviconPath: string) => {
    setIcon(`${FAVICON_PREFIX}${faviconPath}`);
  };

  const handleSearchFavicons = async () => {
    setSearchingFavicons(true);
    try {
      const results = await api.searchFavicons(props.project.id);
      setFavicons(results);
    } catch (error) {
      console.error('Failed to search favicons:', error);
      setFavicons([]);
    } finally {
      setSearchingFavicons(false);
    }
  };

  const isCustomColor = () => {
    return color() && !PRESET_COLORS.includes(color()!);
  };

  const renderIconPreview = () => {
    if (isFaviconIcon(icon())) {
      return (
        <img 
          src={`/api/files/content?path=${encodeURIComponent(getFaviconPath(icon()!))}&project_id=${props.project.id}`}
          alt="favicon"
          class="icon-preview-image"
        />
      );
    }
    return <span class="icon-preview-letter">{icon() || name().charAt(0).toUpperCase() || 'P'}</span>;
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
                  {renderIconPreview()}
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
              
              <div class="favicon-search-section">
                <button 
                  class="favicon-search-btn"
                  onClick={handleSearchFavicons}
                  disabled={searchingFavicons()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  {searchingFavicons() ? 'Searching...' : 'Search favicon in project'}
                </button>
                
                <Show when={favicons().length > 0}>
                  <div class="favicon-results">
                    <label class="favicon-results-label">Found favicons:</label>
                    <div class="favicon-grid">
                      <For each={favicons()}>
                        {(faviconPath) => (
                          <button
                            class={`favicon-item ${icon() === `${FAVICON_PREFIX}${faviconPath}` ? 'active' : ''}`}
                            onClick={() => handleFaviconSelect(faviconPath)}
                            title={faviconPath}
                          >
                            <img 
                              src={`/api/files/content?path=${encodeURIComponent(faviconPath)}&project_id=${props.project.id}`}
                              alt={faviconPath}
                              class="favicon-thumbnail"
                            />
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
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
