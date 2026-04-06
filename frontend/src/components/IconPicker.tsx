import { Component } from 'solid-js';

interface IconPickerProps {
  currentIcon?: string;
  onIconChange: (icon: string) => void;
  onClose: () => void;
}

const PRESET_ICONS = [
  '📁', '📂', '📄', '📝', '🗒️', '📑', '📚', '📖',
  '💼', '🎯', '⭐', '🌟', '💡', '🔥', '🚀', '💻',
  '🎨', '🎬', '🎵', '🎮', '📱', '⚙️', '🔧', '🔨',
  '📊', '📈', '📉', '💳', '💰', '💵', '🏆', '🎁',
  '🌈', '☀️', '🌙', '⚡', '💎', '🔮', '🏠', '🏢',
  '🌍', '🌎', '🌏', '🛠️', '🧪', '🔬', '🧬', '📡',
];

const IconPicker: Component<IconPickerProps> = (props) => {
  const handleIconClick = (icon: string) => {
    props.onIconChange(icon);
    props.onClose();
  };

  return (
    <div class="icon-picker">
      <div class="icon-picker-header">
        <span>选择图标</span>
        <button class="icon-picker-close" onClick={props.onClose}>×</button>
      </div>
      
      <div class="icon-picker-presets">
        {PRESET_ICONS.map(icon => (
          <button
            class={`icon-picker-icon ${props.currentIcon === icon ? 'active' : ''}`}
            onClick={() => handleIconClick(icon)}
            title={icon}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default IconPicker;