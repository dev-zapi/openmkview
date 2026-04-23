import { Component, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { FileNode } from '../types';

interface FileTreeMenuProps {
  node: FileNode;
  position: { top: number; left: number };
  onDelete: () => void;
  onRename: () => void;
  onCopyPath: () => void;
  onClose: () => void;
}

const FileTreeMenu: Component<FileTreeMenuProps> = (props) => {
  return (
    <Show when={true}>
      <Portal mount={document.body}>
        <div
          class="menu-overlay"
          onClick={props.onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            'z-index': 9998,
            background: 'transparent',
          }}
        />
        <div
          class="file-tree-menu-dropdown"
          style={{
            position: 'fixed',
            top: `${props.position.top}px`,
            left: `${props.position.left}px`,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            'border-radius': '6px',
            'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
            'z-index': 9999,
            'min-width': '160px',
            overflow: 'hidden',
            'font-family': 'inherit',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            class="menu-item"
            onClick={() => { props.onRename(); props.onClose(); }}
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '10px',
              padding: '10px 14px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              'font-size': '13px',
              color: 'var(--color-text)',
              'text-align': 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Rename</span>
          </button>
          <button
            class="menu-item"
            onClick={() => { props.onCopyPath(); props.onClose(); }}
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '10px',
              padding: '10px 14px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              'font-size': '13px',
              color: 'var(--color-text)',
              'text-align': 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy Path</span>
          </button>
          <button
            class="menu-item"
            onClick={() => { props.onDelete(); props.onClose(); }}
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '10px',
              padding: '10px 14px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              'font-size': '13px',
              color: 'var(--color-error)',
              'text-align': 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Move to Trash</span>
          </button>
        </div>
      </Portal>
    </Show>
  );
};

export default FileTreeMenu;
