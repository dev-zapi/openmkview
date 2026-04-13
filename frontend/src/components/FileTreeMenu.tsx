import { Component, onMount, onCleanup, createEffect } from 'solid-js';
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
  let menuContainer: HTMLDivElement | null = null;
  let handleClickOutside: ((e: MouseEvent) => void) | null = null;

  const createButton = (
    text: string,
    iconSvg: string,
    onClick: () => void,
    isDelete = false
  ): HTMLButtonElement => {
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
      color: ${isDelete ? 'var(--color-error)' : 'var(--color-text)'};
      text-align: left;
      transition: background 0.15s;
    `;
    btn.innerHTML = `${iconSvg}<span>${text}</span>`;
    btn.onmouseenter = () => {
      btn.style.background = 'var(--color-hover-bg)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'transparent';
    };
    btn.onclick = () => {
      onClick();
      props.onClose();
    };
    return btn;
  };

  onMount(() => {
    menuContainer = document.createElement('div');
    menuContainer.style.cssText = `
      position: fixed;
      top: ${props.position.top}px;
      left: ${props.position.left}px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      min-width: 160px;
      overflow: hidden;
      font-family: inherit;
    `;

    const renameIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const copyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

    menuContainer.appendChild(createButton('Rename', renameIcon, props.onRename));
    menuContainer.appendChild(createButton('Copy Path', copyIcon, props.onCopyPath));
    menuContainer.appendChild(createButton('Move to Trash', deleteIcon, props.onDelete, true));

    document.body.appendChild(menuContainer);

    handleClickOutside = (e: MouseEvent) => {
      if (menuContainer && !menuContainer.contains(e.target as Node)) {
        props.onClose();
      }
    };
    document.addEventListener('click', handleClickOutside);
  });

  createEffect(() => {
    if (menuContainer) {
      menuContainer.style.top = `${props.position.top}px`;
      menuContainer.style.left = `${props.position.left}px`;
    }
  });

  onCleanup(() => {
    if (handleClickOutside) {
      document.removeEventListener('click', handleClickOutside);
    }
    if (menuContainer && menuContainer.parentNode) {
      menuContainer.parentNode.removeChild(menuContainer);
    }
  });

  return null;
};

export default FileTreeMenu;