import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { FileTree as PierreTree } from '@pierre/trees';
import type { FileNode } from '../types';
import type {
  FileTreeOptions,
  FileTreeContextMenuItem,
  FileTreeContextMenuOpenContext,
} from '@pierre/trees';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string, relativePath: string) => void;
  onDelete?: (node: { path: string; name: string; isFolder: boolean }) => void;
  onCopyPath?: (node: { path: string; name: string; isFolder: boolean }) => void;
  onRename?: (node: { path: string; name: string; isFolder: boolean }) => void;
  theme?: 'light' | 'dark';
}

function fileNodesToPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  function traverse(node: FileNode) {
    if (node.isFolder) {
      paths.push(node.path + '/');
      if (node.children) {
        node.children.forEach(traverse);
      }
    } else {
      paths.push(node.path);
    }
  }
  nodes.forEach(traverse);
  return paths;
}

function getTreeStyles(theme: 'light' | 'dark'): Record<string, string> {
  return {
    height: '100%',
    width: '100%',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    '--trees-theme-sidebar-bg': 'var(--color-bg)',
    '--trees-theme-sidebar-fg': 'var(--color-text)',
    '--trees-theme-list-hover-bg': 'var(--color-hover-bg)',
    '--trees-theme-list-active-selection-bg': 'var(--color-active-bg)',
    '--trees-theme-list-active-selection-fg': 'var(--color-text-h)',
    '--trees-theme-focus-ring': 'var(--color-accent)',
    '--trees-theme-input-bg': 'var(--color-bg-subtle)',
    '--trees-theme-sidebar-border': 'var(--color-border)',
  } as Record<string, string>;
}

function createMenuButton(label: string, iconSvg: string, color?: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    width: 100%;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: ${color || 'inherit'};
    text-align: left;
    transition: background 0.15s;
    font-family: inherit;
  `;
  btn.innerHTML = `${iconSvg}<span>${label}</span>`;
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'var(--color-hover-bg, rgba(0,0,0,0.06))';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });
  return btn;
}

function renderContextMenu(
  item: FileTreeContextMenuItem,
  context: FileTreeContextMenuOpenContext,
  props: FileTreeProps
): HTMLElement | null {
  const menu = document.createElement('div');
  menu.style.cssText = `
    background: var(--color-bg, #fff);
    border: 1px solid var(--color-border, #d0d0d0);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 160px;
    overflow: hidden;
    font-family: inherit;
    font-size: 13px;
    color: var(--color-text, #4a4a4a);
  `;

  const renameBtn = createMenuButton(
    'Rename',
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
  );
  renameBtn.addEventListener('click', () => {
    props.onRename?.(item);
    context.close();
  });

  const copyBtn = createMenuButton(
    'Copy Path',
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  );
  copyBtn.addEventListener('click', () => {
    props.onCopyPath?.(item);
    context.close();
  });

  const deleteBtn = createMenuButton(
    'Move to Trash',
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    'var(--color-error, #ef4444)'
  );
  deleteBtn.addEventListener('click', () => {
    props.onDelete?.(item);
    context.close();
  });

  menu.appendChild(renameBtn);
  menu.appendChild(copyBtn);
  menu.appendChild(deleteBtn);

  return menu;
}

const FileTree: Component<FileTreeProps> = (props) => {
  let hostRef: HTMLDivElement | undefined;
  let model: PierreTree | undefined;

  const initTree = () => {
    if (model) {
      model.cleanUp();
    }

    const paths = fileNodesToPaths(props.nodes);

    model = new PierreTree({
      paths,
      initialExpansion: 'open',
      flattenEmptyDirectories: true,
      search: true,
      composition: {
        contextMenu: {
          enabled: true,
          triggerMode: 'both',
          buttonVisibility: 'when-needed',
          render: (item, context) => renderContextMenu(item, context, props),
        },
      },
      onSelectionChange: (selectedPaths) => {
        if (selectedPaths.length === 1) {
          const path = selectedPaths[0];
          const handle = model?.getItem(path);
          if (handle && !handle.isDirectory()) {
            props.onFileClick(path, path);
          }
        }
      },
    } as FileTreeOptions);

    if (hostRef) {
      model.render({ fileTreeContainer: hostRef });
    }
  };

  onMount(() => {
    initTree();
  });

  createEffect(() => {
    const paths = fileNodesToPaths(props.nodes);
    if (model) {
      model.resetPaths(paths);
    }
  });

  onCleanup(() => {
    if (model) {
      model.cleanUp();
      model = undefined;
    }
  });

  return (
    <div
      ref={hostRef}
      class="pierre-file-tree-host"
      style={getTreeStyles(props.theme || 'light')}
    />
  );
};

export default FileTree;
