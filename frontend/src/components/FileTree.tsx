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

const ChevronIcon: Component<{ expanded: boolean }> = (props) => (
  <svg
    class={`tree-chevron ${props.expanded ? 'expanded' : ''}`}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

const FolderIcon: Component<{ expanded: boolean }> = (props) => (
  <Show
    when={props.expanded}
    fallback={
      <svg
        class="node-icon-svg folder-node-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2.75 6A1.75 1.75 0 0 1 4.5 4.25h2.12c.53 0 1.04.21 1.41.59l.63.63c.37.37.88.58 1.41.58h4.43A1.75 1.75 0 0 1 16.25 7.8v5.95A1.75 1.75 0 0 1 14.5 15.5h-10A1.75 1.75 0 0 1 2.75 13.75z" />
      </svg>
    }
  >
    <svg
      class="node-icon-svg folder-node-icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.75 6A1.75 1.75 0 0 1 4.5 4.25h2.12c.53 0 1.04.21 1.41.59l.63.63c.37.37.88.58 1.41.58h4.43A1.75 1.75 0 0 1 16.25 7.8v.7" />
      <path d="M2.75 8.75h13.5l-1.08 4.34a1.75 1.75 0 0 1-1.7 1.33H4.46a1.75 1.75 0 0 1-1.7-1.33z" />
    </svg>
  </Show>
);

const FileKindIcon: Component<{ fileType?: FileNode['fileType'] }> = (props) => (
  <Show
    when={props.fileType === 'image'}
    fallback={
      <svg
        class="node-icon-svg file-node-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 2.75h5.25L14.5 6v8A1.75 1.75 0 0 1 12.75 15.75h-6.5A1.75 1.75 0 0 1 4.5 14V4.5A1.75 1.75 0 0 1 6.25 2.75z" />
        <path d="M11.25 2.75V6h3.25" />
      </svg>
    }
  >
    <svg
      class="node-icon-svg image-node-icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M6 2.75h5.25L14.5 6v8A1.75 1.75 0 0 1 12.75 15.75h-6.5A1.75 1.75 0 0 1 4.5 14V4.5A1.75 1.75 0 0 1 6.25 2.75z" />
      <path d="M11.25 2.75V6h3.25" />
      <circle cx="8" cy="8.25" r="1" />
      <path d="m7 13 2-2 1.25 1.25L11.5 11 13 13" />
    </svg>
  </Show>
);

const TreeNode: Component<TreeNodeProps> = (props) => {
  const isExpanded = () => props.expandedFolders?.has(props.node.path) || false;
  const hasChildren = () => Boolean(props.node.children?.length);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0 });
  let menuButtonRef: HTMLButtonElement | undefined;

  const handleClick = () => {
    if (props.node.isFolder) {
      if (!hasChildren()) return;
      const newExpanded = !isExpanded();
      props.onFolderToggle?.(props.node.path, newExpanded);
    } else {
      props.onFileClick(props.node.path, props.node.id);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    e.preventDefault();
    handleClick();
  };

  const handleMenuToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen() && menuButtonRef) {
      const rect = menuButtonRef.getBoundingClientRect();
      const menuWidth = 160;
      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      setMenuPosition({
        top: rect.bottom + 4,
        left: left
      });
    }
    setMenuOpen(!menuOpen());
  };

  const renderLeadingIcon = () => {
    if (props.node.isFolder) {
      return (
        <span class="icon" aria-hidden="true">
          <Show when={hasChildren()} fallback={<span class="tree-chevron-spacer" />}>
            <ChevronIcon expanded={isExpanded()} />
          </Show>
          <FolderIcon expanded={isExpanded()} />
        </span>
      );
    }

    return (
      <span class="icon" aria-hidden="true">
        <span class="tree-chevron-spacer" />
        <FileKindIcon fileType={props.node.fileType} />
      </span>
    );
  };

  return (
    <li>
      <div
        class={`tree-item ${props.node.isFolder ? 'folder' : 'file'} ${props.node.fileType === 'image' ? 'image-file' : ''}`}
      >
        <div
          class="tree-item-content"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-expanded={props.node.isFolder && hasChildren() ? isExpanded() : undefined}
        >
          {renderLeadingIcon()}
          <span class="name">{props.node.name}</span>
        </div>
        <div class="tree-item-menu">
          <button 
            class="menu-button" 
            onClick={handleMenuToggle}
            ref={menuButtonRef}
            aria-label="Open file actions menu"
            title="File actions"
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
