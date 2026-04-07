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
import type { RecentProject, PathCandidate } from '../../types/openProject';
import './OpenProjectDialog.css';

export interface OpenProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectOpened: (project: RecentProject) => void;
}

interface ListableItem {
  path: string;
  name: string;
  icon: string;
  relativePath?: string;
}

const OpenProjectDialog: Component<OpenProjectDialogProps> = (props) => {
  const { 
    state, 
    recentProjects, 
    isLoadingRecent,
    searchQuery,
    debouncedQuery,
    searchResults,
    isSearching,
    setSearchQuery,
    openProjectByPath,
    clearError 
  } = useOpenProject(() => props.isOpen, props.onProjectOpened);
  
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
      setSearchQuery('');
      clearError();
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
      openProjectByPath(allListItems()[selectedIndex()].path);
    } else if (searchResults().length > 0) {
      openProjectByPath(searchResults()[0].path);
    } else if (value.trim()) {
      openProjectByPath(value.trim());
    }
  };

  const allListItems = createMemo<ListableItem[]>(() => {
    const items: ListableItem[] = [];
    const query = debouncedQuery();
    
    // 无搜索时显示最近项目
    if (!query) {
      const recent = recentProjects().slice(0, 3);
      for (const p of recent) {
        items.push({ path: p.path, name: p.name, icon: '📁' });
      }
      return items;
    }
    
    // 有搜索时合并：本地过滤 + API搜索结果
    const lowerQuery = query.toLowerCase();
    const filteredRecent = recentProjects()
      .filter((p: RecentProject) => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.path.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 3);
    
    for (const p of filteredRecent) {
      items.push({ path: p.path, name: p.name, icon: '📁' });
    }
    
    const results = searchResults();
    if (results.length > 0) {
      for (const r of results.slice(0, 5)) {
        items.push({ 
          path: r.path, 
          name: r.name, 
          icon: '📁', 
          relativePath: r.relative_path 
        });
      }
    }
    
    return items;
  });

  const handleTab = () => {
    const firstItem = allListItems()[0];
    if (firstItem) {
      setSearchQuery(firstItem.path);
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
        openProjectByPath(items[current].path);
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
                value={searchQuery()}
                onChange={setSearchQuery}
                onSubmit={handleInputSubmit}
                onTab={handleTab}
                onKeyDown={handleInputKeyDown}
                placeholder="Search folders"
                disabled={state.isLoading}
                loading={isSearching()}
                ref={(el) => inputRef = el}
              />
              
              {/* Error Message */}
              <Show when={state.error}>
                <div class="error-message">
                  {state.error}
                </div>
              </Show>
            </div>

            {/* List Items */}
            <For each={allListItems()}>
              {(item, index) => (
                <div 
                  class={`folder-item ${selectedIndex() === index() ? 'selected' : ''}`}
                  onClick={() => openProjectByPath(item.path)}
                  onKeyDown={handleListItemKeyDown}
                  tabIndex={0}
                  role="button"
                >
                  <span class="folder-icon">{item.icon}</span>
                  <Show when={item.relativePath} fallback={<span class="folder-path">{item.path}</span>}>
                    <div class="folder-info">
                      <span class="folder-name">{item.name}</span>
                      <span class="folder-path-small">{item.relativePath}</span>
                    </div>
                  </Show>
                </div>
              )}
            </For>

            <Show when={isLoadingRecent()}>
              <div class="loading-text">Loading...</div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default OpenProjectDialog;
