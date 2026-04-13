import { Component } from 'solid-js';
import type { FileNode } from '../types';

interface FileTreeMenuProps {
  node: FileNode;
  onDelete: () => void;
  onRename: () => void;
  onCopyPath: () => void;
  onClose: () => void;
}

const FileTreeMenu: Component<FileTreeMenuProps> = (props) => {
  return (
    <div class="file-tree-menu-dropdown">
      <button class="menu-item" onClick={props.onRename}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>Rename</span>
      </button>
      <button class="menu-item" onClick={props.onCopyPath}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>Copy Path</span>
      </button>
      <button class="menu-item delete" onClick={props.onDelete}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>Move to Trash</span>
      </button>
    </div>
  );
};

export default FileTreeMenu;