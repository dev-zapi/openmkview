import { Component, Show, createSignal } from 'solid-js';

interface ColorPickerProps {
  currentColor?: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#FF6B6B',
  '#FF8E53',
  '#FFA94D',
  '#FFD43B',
  '#A9E34B',
  '#69DB7C',
  '#38D9A9',
  '#3BC9DB',
  '#4DABF7',
  '#748FFC',
  '#9775FA',
  '#DA77F2',
  '#F783AC',
  '#E599F7',
  '#B197FC',
  '#845EF7',
  '#5C7CFA',
  '#339AF0',
  '#22B8CF',
  '#20C997',
  '#12B886',
  '#40C057',
  '#82C91E',
  '#FAB005',
  '#FD7E14',
  '#E03131',
  '#C92A2A',
  '#862E9C',
  '#5F3DC4',
  '#364FC7',
];

const ColorPicker: Component<ColorPickerProps> = (props) => {
  const [customColor, setCustomColor] = createSignal(props.currentColor || '#4DABF7');
  const [showCustom, setShowCustom] = createSignal(false);

  const handlePresetClick = (color: string) => {
    props.onColorChange(color);
    props.onClose();
  };

  const handleCustomSubmit = () => {
    const color = customColor();
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      props.onColorChange(color);
      props.onClose();
    }
  };

  return (
    <div class="color-picker">
      <div class="color-picker-header">
        <span>Select Color</span>
        <button class="color-picker-close" onClick={props.onClose}>×</button>
      </div>
      
      <div class="color-picker-presets">
        {PRESET_COLORS.map(color => (
          <button
            class={`color-picker-preset ${props.currentColor === color ? 'active' : ''}`}
            style={{ background: color }}
            onClick={() => handlePresetClick(color)}
            title={color}
          />
        ))}
      </div>

      <div class="color-picker-divider">
        <span>or customize</span>
      </div>

      <Show when={showCustom()}>
        <div class="color-picker-custom">
          <input
            type="color"
            value={customColor()}
            onInput={(e) => setCustomColor(e.currentTarget.value)}
            class="color-picker-native"
          />
          <input
            type="text"
            value={customColor()}
            onInput={(e) => setCustomColor(e.currentTarget.value)}
            placeholder="#RRGGBB"
            class="color-picker-input"
          />
          <button class="color-picker-apply" onClick={handleCustomSubmit}>
            Apply
          </button>
        </div>
      </Show>

      <Show when={!showCustom()}>
        <button class="color-picker-custom-toggle" onClick={() => setShowCustom(true)}>
          Custom Color
        </button>
      </Show>
    </div>
  );
};

export default ColorPicker;