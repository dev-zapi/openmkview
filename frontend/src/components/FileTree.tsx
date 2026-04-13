import { Component, For, Show, createSignal } from 'solid-js';
import type { FileNode } from '../types';
import FileTreeMenu from './FileTreeMenu';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string, relativePath: string) => void;
  expandedFolders?: Set<string>;
  onFolderToggle?: (path: string, expanded: boolean) => void;
  onDelete?: (node: FileNode) => void;
  onRename?: (node: FileNode) => void;
  onCopyPath?: (node: FileNode) => void;
}

interface TreeNodeProps {
  node: FileNode;
  onFileClick: (path: string, relativePath: string) => void;
  expandedFolders?: Set<string>;
  onFolderToggle?: (path: string, expanded: boolean) => void;
  onDelete?: (node: FileNode) => void;
  onRename?: (node: FileNode) => void;
  onCopyPath?: (node: FileNode) => void;
}

const TreeNode: Component<TreeNodeProps> = (props) => {
  const isExpanded = () => props.expandedFolders?.has(props.node.path) || false;
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0 });
  let menuButtonRef: HTMLButtonElement | undefined;

  const handleClick = () => {
    if (props.node.isFolder) {
      const newExpanded = !isExpanded();
      props.onFolderToggle?.(props.node.path, newExpanded);
    } else {
      props.onFileClick(props.node.path, props.node.id);
    }
  };

  const handleMenuToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen() && menuButtonRef) {
      const rect = menuButtonRef.getBoundingClientRect();
      const menuWidth = 160;
      // Position menu with its right edge aligned to button right, but ensure it doesn't go off-screen
      let left = rect.right - menuWidth;
      if (left < 10) left = 10; // Minimum left margin
      setMenuPosition({
        top: rect.bottom + 4,
        left: left
      });
    }
    setMenuOpen(!menuOpen());
  };

  return (
    <li>
      <div
        class={`tree-item ${props.node.isFolder ? 'folder' : 'file'}`}
      >
        <div class="tree-item-content" onClick={handleClick}>
          <span class={`icon ${props.node.isFolder ? (isExpanded() ? 'folder-icon expanded' : 'folder-icon') : ''}`}>
            {props.node.isFolder ? (isExpanded() ? '📂' : '📁') : '📄'}
          </span>
          <span class="name">{props.node.name}</span>
        </div>
        <div class="tree-item-menu">
          <button 
            class="menu-button" 
            onClick={handleMenuToggle}
            ref={menuButtonRef}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          <Show when={menuOpen()}>
            <FileTreeMenu
              node={props.node}
              position={menuPosition()}
              onDelete={() => {
                props.onDelete?.(props.node);
                setMenuOpen(false);
              }}
              onRename={() => {
                props.onRename?.(props.node);
                setMenuOpen(false);
              }}
              onCopyPath={() => {
                props.onCopyPath?.(props.node);
                setMenuOpen(false);
              }}
              onClose={() => setMenuOpen(false)}
            />
          </Show>
        </div>
      </div>
      <Show when={props.node.isFolder && isExpanded() && props.node.children}>
        <ul class="folder-children">
          <For each={props.node.children}>
            {(child) => (
              <TreeNode 
                node={child} 
                onFileClick={props.onFileClick}
                expandedFolders={props.expandedFolders}
                onFolderToggle={props.onFolderToggle}
                onDelete={props.onDelete}
                onRename={props.onRename}
                onCopyPath={props.onCopyPath}
              />
            )}
          </For>
        </ul>
      </Show>
    </li>
  );
};

const FileTree: Component<FileTreeProps> = (props) => {
  return (
    <div class="file-tree">
      <ul>
        <For each={props.nodes}>
          {(node) => (
            <TreeNode 
              node={node} 
              onFileClick={props.onFileClick}
              expandedFolders={props.expandedFolders}
              onFolderToggle={props.onFolderToggle}
              onDelete={props.onDelete}
              onRename={props.onRename}
              onCopyPath={props.onCopyPath}
            />
          )}
        </For>
      </ul>
    </div>
  );
};

export default FileTree;
