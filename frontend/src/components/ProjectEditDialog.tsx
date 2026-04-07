import { Component, createSignal, Show } from 'solid-js';
import ColorPicker from './ColorPicker';
import IconPicker from './IconPicker';
import type { Project } from '../types';

interface ProjectEditDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
}

const ProjectEditDialog: Component<ProjectEditDialogProps> = (props) => {
  const [name, setName] = createSignal(props.project.name);
  const [color, setColor] = createSignal(props.project.color);
  const [icon, setIcon] = createSignal(props.project.icon);
  const [colorPickerOpen, setColorPickerOpen] = createSignal(false);
  const [iconPickerOpen, setIconPickerOpen] = createSignal(false);

  const handleSave = () => {
    props.onSave({
      ...props.project,
      name: name(),
      color: color(),
      icon: icon(),
    });
    props.onClose();
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setColorPickerOpen(false);
  };

  const handleIconChange = (newIcon: string) => {
    setIcon(newIcon);
    setIconPickerOpen(false);
  };

  return (
    <Show when={props.isOpen}>
      <div class="dialog-overlay" onClick={props.onClose}>
        <div class="dialog-content" onClick={(e) => e.stopPropagation()}>
          <div class="dialog-header">
            <h3>编辑项目</h3>
            <button class="dialog-close" onClick={props.onClose}>×</button>
          </div>

          <div class="dialog-body">
            <div class="form-group">
              <label>项目名称</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="form-input"
              />
            </div>

            <div class="form-group picker-group">
              <label>项目颜色</label>
              <div class="picker-row">
                <button
                  class="picker-button"
                  style={{ background: color() || 'var(--color-bg-subtle)' }}
                  onClick={() => setColorPickerOpen(!colorPickerOpen())}
                >
                  {color() ? '' : '选择'}
                </button>
                <Show when={color()}>
                  <button
                    class="clear-button"
                    onClick={() => setColor(undefined)}
                  >
                    清除
                  </button>
                </Show>
              </div>
              <Show when={colorPickerOpen()}>
                <div class="picker-popup">
                  <ColorPicker
                    currentColor={color()}
                    onColorChange={handleColorChange}
                    onClose={() => setColorPickerOpen(false)}
                  />
                </div>
              </Show>
            </div>

            <div class="form-group picker-group">
              <label>项目图标</label>
              <div class="picker-row">
                <button
                  class="picker-button"
                  onClick={() => setIconPickerOpen(!iconPickerOpen())}
                >
                  <Show when={icon()} fallback={<span class="picker-placeholder">选择</span>}>
                    <span class="picker-icon">{icon()}</span>
                  </Show>
                </button>
                <Show when={icon()}>
                  <button
                    class="clear-button"
                    onClick={() => setIcon(undefined)}
                  >
                    清除
                  </button>
                </Show>
              </div>
              <Show when={iconPickerOpen()}>
                <div class="picker-popup">
                  <IconPicker
                    currentIcon={icon()}
                    onIconChange={handleIconChange}
                    onClose={() => setIconPickerOpen(false)}
                  />
                </div>
              </Show>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="dialog-button cancel" onClick={props.onClose}>
              取消
            </button>
            <button class="dialog-button save" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ProjectEditDialog;