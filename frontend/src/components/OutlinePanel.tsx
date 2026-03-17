import { Component, For, Show } from 'solid-js';
import type { Heading } from '../types';

interface OutlinePanelProps {
  headings: Heading[];
  isOpen: boolean;
  onClose: () => void;
  onHeadingClick?: (id: string) => void;
}

const OutlinePanel: Component<OutlinePanelProps> = (props) => {
  const handleClick = (id: string) => {
    if (props.onHeadingClick) {
      props.onHeadingClick(id);
    } else {
      // 默认行为：滚动到对应标题
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const getIndentStyle = (level: number) => {
    return { 'padding-left': `${(level - 1) * 16}px` };
  };

  return (
    <Show when={props.isOpen}>
      <div class="outline-panel">
        <div class="outline-panel-header">
          <h3>📋 Outline</h3>
          <button class="close-btn" onClick={props.onClose}>✕</button>
        </div>

        <div class="outline-panel-content">
          <Show
            when={props.headings && props.headings.length > 0}
            fallback={<div class="outline-empty">No headings found</div>}
          >
            <For each={props.headings}>
              {(heading) => (
                <div
                  class="outline-item"
                  style={getIndentStyle(heading.level)}
                  onClick={() => handleClick(heading.id)}
                  title={heading.text}
                >
                  <span class={`outline-level outline-level-${heading.level}`}>
                    H{heading.level}
                  </span>
                  <span class="outline-text">{heading.text}</span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default OutlinePanel;
