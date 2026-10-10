import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { FileTree as PierreTree } from '@pierre/trees';
import type { DocumentFileType, FileNode } from '../types';
import { fileStore } from '../stores/fileStore';
import { api } from '../services/api';
import { exportDocument, type ExportFormat } from '../utils/markdownExport';
import type {
  FileTreeOptions,
  ContextMenuItem,
  ContextMenuOpenContext,
  FileTreeDropResult,
} from '@pierre/trees';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string, relativePath: string) => void;
  onDelete?: (node: FileNode) => void;
  onCopyPath?: (node: FileNode) => void;
  onRename?: (node: FileNode) => void;
  theme?: 'light' | 'dark';
  projectId?: number;
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

function getTreeStyles(_theme: 'light' | 'dark'): Record<string, string> {
  return {
    height: '100%',
    width: '100%',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    // Pierre trees computes the scroll container's right padding as
    //   max(padding-inline - item-margin-x - scrollbar-gutter-measured, 0)
    // and the left padding as
    //   max(padding-inline - item-margin-x, 0)
    // The intent is that "right padding + scrollbar width" equals "left padding"
    // — but only when `padding-inline >= item-margin-x + scrollbar-gutter`,
    // otherwise the right side clamps to 0 and the row content sits flush
    // against the (Chrome-rendered) scrollbar, making the right gap visibly
    // larger than the left. Chrome reports ~10px from our global
    // `::-webkit-scrollbar { width: 10px }`, while Firefox's `scrollbar-width:
    // thin` measures ~0–6px, which is why the asymmetry only shows in Chrome.
    // Use 12px (= 2px item-margin + 10px scrollbar) so both browsers land on
    // a symmetric 10px visual inset on each side.
    '--trees-padding-inline-override': '12px',
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

function createMenuButton(label: string, iconSvg: string, destructive?: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = destructive ? 'ui-menu-item ui-menu-item-destructive' : 'ui-menu-item';
  // iconSvg is a static in-repo constant; the label goes through textContent.
  const iconWrapper = document.createElement('span');
  iconWrapper.style.display = 'inline-flex';
  const tpl = document.createElement('template');
  tpl.innerHTML = iconSvg;
  iconWrapper.appendChild(tpl.content.cloneNode(true));
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  btn.appendChild(iconWrapper);
  btn.appendChild(labelSpan);
  return btn;
}

const createMenuSeparator = (): HTMLDivElement => {
  const sep = document.createElement('div');
  sep.className = 'ui-menu-separator';
  sep.setAttribute('role', 'separator');
  return sep;
};

const renameIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const copyIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const trashIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const exportIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

/** Document type inferred from the file extension; null when not exportable. */
function getDocumentType(name: string): DocumentFileType | null {
  if (/\.(md|mdx|markdown)$/i.test(name)) return 'markdown';
  if (/\.html?$/i.test(name)) return 'html';
  return null;
}

function exportNodeFile(node: FileNode, projectId: number, format: ExportFormat): void {
  const docType = getDocumentType(node.name);
  if (!docType) return;
  api
    .getFileContent(node.path, projectId)
    .then((file) => exportDocument(docType, file.fileName || node.name, file.content, format))
    .catch((err: Error) => {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    });
}

/** projectId may be NaN in mock mode — only undefined means "no project". */
const hasProject = (id: number | undefined): id is number => id !== undefined;

function renderContextMenu(
  item: ContextMenuItem,
  context: ContextMenuOpenContext,
  props: FileTreeProps
): HTMLElement | null {
  const node = fileStore.findNodeByPath(item.path) || {
    id: item.path,
    name: item.name,
    path: item.path,
    isFolder: item.kind === 'directory',
  };

  // `menuRoot` is the placeholder element returned to the library — its
  // lifecycle is owned by `@pierre/trees` (it is inserted into the file-tree
  // slot and removed when the menu closes). The actual visible menu is
  // portaled into `document.body` so it escapes ancestors that establish a
  // containing block (e.g. ancestors with `will-change: transform` /
  // `contain: layout` from the virtualization layer) and the sidebar's
  // stacking context.
  const menuRoot = document.createElement('div');
  menuRoot.setAttribute('data-file-tree-context-menu-root', 'true');
  menuRoot.style.cssText = 'display: contents;';

  const menu = document.createElement('div');
  // Tag the portaled element too so library outside-click logic recognises
  // clicks inside it.
  menu.setAttribute('data-file-tree-context-menu-root', 'true');
  menu.className = 'ui-menu';
  menu.setAttribute('role', 'menu');

  const isFolder = item.kind === 'directory';
  const docType = isFolder ? null : getDocumentType(item.name);

  const renameBtn = createMenuButton('Rename', renameIcon);
  renameBtn.addEventListener('click', () => {
    props.onRename?.(node);
    context.close();
  });

  const copyBtn = createMenuButton('Copy Path', copyIcon);
  copyBtn.addEventListener('click', () => {
    props.onCopyPath?.(node);
    context.close();
  });

  const deleteBtn = createMenuButton('Move to Trash', trashIcon, true);
  deleteBtn.addEventListener('click', () => {
    props.onDelete?.(node);
    context.close();
  });

  menu.appendChild(renameBtn);
  menu.appendChild(copyBtn);

  // Export entries for markdown/html documents
  let exportCount = 0;
  if (docType && hasProject(props.projectId)) {
    const pid = props.projectId;
    const exportTargets: { format: ExportFormat; label: string }[] =
      docType === 'html'
        ? [
            { format: 'pdf', label: 'Export as PDF' },
            { format: 'html', label: 'Export as HTML' },
          ]
        : [
            { format: 'pdf', label: 'Export as PDF' },
            { format: 'html', label: 'Export as HTML' },
            { format: 'md', label: 'Export as Markdown' },
          ];
    menu.appendChild(createMenuSeparator());
    for (const target of exportTargets) {
      const btn = createMenuButton(target.label, exportIcon);
      btn.addEventListener('click', () => {
        context.close();
        exportNodeFile(node, pid, target.format);
      });
      menu.appendChild(btn);
      exportCount++;
    }
  }

  menu.appendChild(createMenuSeparator());
  menu.appendChild(deleteBtn);

  // Keep the fixed-position box inside the viewport.
  const menuWidth = 200;
  const itemCount = 3 + exportCount;
  const separatorCount = exportCount > 0 ? 2 : 1;
  const menuHeight = itemCount * 32 + separatorCount * 9 + 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = context.anchorRect.right - menuWidth;
  let top = context.anchorRect.bottom + 4;

  if (left + menuWidth > viewportWidth - 8) {
    left = viewportWidth - menuWidth - 8;
  }
  if (left < 8) {
    left = 8;
  }
  if (top + menuHeight > viewportHeight - 8) {
    top = Math.max(8, context.anchorRect.top - menuHeight - 4);
  }

  menu.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    z-index: 10000;
    width: ${menuWidth}px;
    box-sizing: border-box;
  `;

  document.body.appendChild(menu);

  // Mirror `menuRoot`'s removal onto the portaled `menu`.
  const observer = new MutationObserver(() => {
    if (!menuRoot.isConnected) {
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return menuRoot;
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
      initialExpansion: 'closed',
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
      dragAndDrop: {
        canDrag: (paths) => paths.length === 1,
        canDrop: (event) => {
          const { target, draggedPaths } = event;
          if (target.kind === 'root') return true;
          if (target.kind === 'directory') {
            const dirPath = target.directoryPath!;
            const draggedPath = draggedPaths[0];
            // Can't drop onto self
            if (draggedPath === dirPath) return false;
            // Can't drop onto own descendant (cycle prevention)
            if (dirPath.startsWith(draggedPath)) return false;
            return true;
          }
          return false;
        },
        onDropComplete: (event: FileTreeDropResult) => {
          if (event.operation !== 'move') return;

          const { draggedPaths, target } = event;
          const from = draggedPaths[0];
          let to = target.kind === 'root' ? '' : (target.directoryPath || '');
          // Strip trailing slash from directory path for the API
          if (to.endsWith('/')) to = to.slice(0, -1);

          const pid = props.projectId;
          if (!pid) return;

          api.moveFile(from, to, pid)
            .then(() => api.getFileTree(pid))
            .then((tree) => fileStore.setFileTree(tree))
            .catch((err: Error) => {
              console.error('Move failed:', err);
              alert(`Failed to move: ${err.message || 'Unknown error'}`);
              // Re-sync tree state from server on error
              api.getFileTree(pid)
                .then((tree) => fileStore.setFileTree(tree))
                .catch(() => {});
            });
        },
        openOnDropDelay: 800,
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
