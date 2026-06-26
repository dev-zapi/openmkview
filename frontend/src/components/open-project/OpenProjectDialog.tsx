/**
 * OpenProjectDialog - 简化版项目打开对话框
 * 
 * 结构：
 * - Header: Open project + 关闭按钮
 * - PathInput: 搜索输入框
 * - Error: 错误信息显示
 * - Recent projects: 最近项目列表（最多3个）
 * - Open project: 快速访问文件夹
 */

import { Component, Show, For, createSignal, createEffect, createMemo } from 'solid-js';
import { useOpenProject } from './hooks/useOpenProject';
import PathInput from './PathInput';
import type { RecentProject } from '../../types/openProject';
import FolderItem from './FolderItem';
import './OpenProjectDialog.css';
import { buildListItems } from './utils/listItems';

export interface OpenProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectOpened: (project: RecentProject) => void;
}

const OpenProjectDialog: Component<OpenProjectDialogProps> = (props) => {
  const hook = useOpenProject(() => props.isOpen, props.onProjectOpened);
  
  const [isClosing, setIsClosing] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  let inputRef: HTMLInputElement | undefined;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      props.onClose();
    }, 150);
  };

  createEffect(() => {
    if (!props.isOpen) {
      setIsClosing(false);
      hook.setSearchQuery('');
      hook.clearError();
      setSelectedIndex(-1);
    } else {
      setSelectedIndex(-1);
    }
  });

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleInputSubmit = (value: string) => {
    if (selectedIndex() >= 0 && allListItems().length > selectedIndex()) {
      hook.openProjectByPath(allListItems()[selectedIndex()].path);
    } else if (hook.searchResults().length > 0) {
      hook.openProjectByPath(hook.searchResults()[0].path);
    } else if (value.trim()) {
      hook.openProjectByPath(value.trim());
    }
  };

  const allListItems = createMemo(() => {
    return buildListItems(hook.debouncedQuery(), hook.recentProjects(), hook.searchResults());
  });

  const handleTab = () => {
    const firstItem = allListItems()[0];
    if (firstItem) {
      hook.setSearchQuery(firstItem.path);
      setSelectedIndex(0);
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    const items = allListItems();
    const current = selectedIndex();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (current < items.length - 1) {
        setSelectedIndex(current + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (current > 0) {
        setSelectedIndex(current - 1);
      } else if (current === 0) {
        setSelectedIndex(-1);
        inputRef?.focus();
      }
    }
  };

  const handleListItemKeyDown = (e: KeyboardEvent) => {
    const items = allListItems();
    const current = selectedIndex();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (current < items.length - 1) {
        setSelectedIndex(current + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (current > 0) {
        setSelectedIndex(current - 1);
      } else if (current === 0) {
        setSelectedIndex(-1);
        inputRef?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (current >= 0 && items[current]) {
        hook.openProjectByPath(items[current].path);
      }
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class={`open-project-overlay ${isClosing() ? 'closing' : ''}`}
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-project-title"
      >
        <div class={`open-project-dialog ${isClosing() ? 'closing' : ''}`}>
          {/* Header */}
          <div class="open-project-header">
            <h2 id="open-project-title" class="open-project-title">
              Open project
            </h2>
            <button
              class="open-project-close-btn"
              onClick={handleClose}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div class="open-project-body">
            {/* Search Input */}
            <div class="search-section">
              <PathInput
                value={hook.searchQuery()}
                onChange={hook.setSearchQuery}
                onSubmit={handleInputSubmit}
                onTab={handleTab}
                onKeyDown={handleInputKeyDown}
                placeholder="Search folders"
                disabled={hook.state.isLoading}
                loading={hook.isSearching()}
                ref={(el) => inputRef = el}
              />
              
              {/* Error Message */}
              <Show when={hook.state.error}>
                <div class="error-message">
                  {hook.state.error}
                </div>
              </Show>
            </div>

            {/* List Items Container - Scrollable */}
            <Show when={allListItems().length > 0 || hook.isLoadingRecent()}>
              <div class="folder-list-container">
                <For each={allListItems()}>
                  {(item, index) => (
                    <FolderItem
                      item={item}
                      index={index()}
                      selectedIndex={selectedIndex()}
                      showRecentTitle={item.type === 'recent' && (index() === 0 || allListItems()[index() - 1]?.type !== 'recent')}
                      showQuickAccessTitle={false}
                      showSearchTitle={item.type === 'searchResult' && (index() === 0 || allListItems()[index() - 1]?.type !== 'searchResult')}
                      onClick={(path) => hook.openProjectByPath(path)}
                      onKeyDown={handleListItemKeyDown}
                    />
                  )}
                </For>

                <Show when={hook.isLoadingRecent()}>
                  <div class="loading-text">Loading...</div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default OpenProjectDialog;
