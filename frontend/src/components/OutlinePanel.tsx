import { Component, For, Show } from 'solid-js';
import type { Heading } from '../types';

interface OutlinePanelProps {
  headings: Heading[];
  isOpen: boolean;
  onClose: () => void;
  onHeadingClick?: (id: string) => void;
  showCloseButton?: boolean;
  outlineWidth: number;
  transition: string;
  onStartDragging: () => void;
}

const OutlinePanel: Component<OutlinePanelProps> = (props) => {
  const handleClick = (id: string, e: MouseEvent) => {
    e.preventDefault();
    
    const element = document.getElementById(id);
    const contentArea = document.querySelector('.content-main');
    
    if (element && contentArea) {
      const rect = element.getBoundingClientRect();
      const containerRect = contentArea.getBoundingClientRect();
      const scrollTop = contentArea.scrollTop;
      const offsetTop = rect.top - containerRect.top + scrollTop - 60;
      
      contentArea.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
      
      element.style.transition = 'background-color 0.3s ease';
      element.style.backgroundColor = 'var(--color-accent-bg, rgba(139, 92, 246, 0.15))';
      element.style.borderRadius = '4px';
      
      setTimeout(() => {
        element.style.backgroundColor = '';
        element.style.borderRadius = '';
      }, 1200);
    } else if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    props.onHeadingClick?.(id);
  };

  const getIndentStyle = (depth: number) => {
    return { 'padding-left': `${(depth - 1) * 16}px` };
  };

  const getLevelIcon = (depth: number) => {
    switch (depth) {
      case 1: return 'H1';
      case 2: return 'H2';
      case 3: return 'H3';
      case 4: return 'H4';
      case 5: return 'H5';
      case 6: return 'H6';
      default: return `H${depth}`;
    }
  };

  return (
    <div 
      class={`outline-panel ${props.isOpen ? '' : 'outline-panel-hidden'}`}
      style={{ width: props.isOpen ? `${props.outlineWidth}px` : '0px', transition: props.transition }}
    >
      <div class="outline-panel-header">
        <h3>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
          Outline
        </h3>
        <Show when={props.showCloseButton}>
          <button
            class="outline-close-btn"
            onClick={props.onClose}
            aria-label="Close outline"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </Show>
      </div>

      <div class="outline-panel-content">
        <Show
          when={props.headings && props.headings.length > 0}
          fallback={
            <div class="outline-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <p>No headings found</p>
            </div>
          }
        >
          <For each={props.headings}>
            {(heading) => (
              <div
                class="outline-item outline-item-animate"
                style={getIndentStyle(heading.depth)}
                onClick={(e) => handleClick(heading.id, e)}
                title={heading.text}
              >
                <span class={`outline-level outline-level-${heading.depth}`}>
                  {getLevelIcon(heading.depth)}
                </span>
                <span class="outline-text">{heading.text}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
      
      <div class="outline-resize-handle" onMouseDown={props.onStartDragging} />
    </div>
  );
};

export default OutlinePanel;
