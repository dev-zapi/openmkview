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
import './OpenProjectDialog.css';

export interface OpenProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectOpened: (project: RecentProject) => void;
}

interface QuickAccessFolder {
  name: string;
  path: string;
  icon: string;
}

const quickAccessFolders: QuickAccessFolder[] = [
  { name: 'Desktop', path: '~/Desktop/', icon: '💻' },
  { name: 'Documents', path: '~/Documents/', icon: '📄' },
  { name: 'Downloads', path: '~/Downloads/', icon: '📥' },
  { name: 'Music', path: '~/Music/', icon: '🎵' },
  { name: 'Pictures', path: '~/Pictures/', icon: '🖼️' },
];

const OpenProjectDialog: Component<OpenProjectDialogProps> = (props) => {
  const { 
    state, 
    recentProjects, 
    isLoadingRecent,
    searchQuery,
    searchResults,
    isSearching,
    setSearchQuery,
    openProjectByPath,
    clearError 
  } = useOpenProject(() => props.isOpen, props.onProjectOpened);
  
  const [isClosing, setIsClosing] = createSignal(false);

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
    // 如果搜索有结果，打开第一个
    if (searchResults().length > 0) {
      openProjectByPath(searchResults()[0].path);
    } else if (value.trim()) {
      // 否则尝试直接打开输入的路径
      openProjectByPath(value.trim());
    }
  };

  // 过滤最近项目（限制3个）
  const filteredRecentProjects = createMemo(() => {
    const projects = recentProjects();
    if (!searchQuery()) return projects.slice(0, 3);
    
    const query = searchQuery().toLowerCase();
    return projects
      .filter((p: RecentProject) => p.name.toLowerCase().includes(query) || p.path.toLowerCase().includes(query))
      .slice(0, 3);
  });

  // 过滤快速访问文件夹
  const filteredQuickAccess = createMemo(() => {
    if (!searchQuery()) return quickAccessFolders;
    
    const query = searchQuery().toLowerCase();
    return quickAccessFolders.filter(f => 
      f.name.toLowerCase().includes(query) || 
      f.path.toLowerCase().includes(query)
    );
  });

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
              aria-label="关闭"
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
                placeholder="Search folders"
                disabled={state.isLoading}
                loading={isSearching()}
              />
              
              {/* Error Message */}
              <Show when={state.error}>
                <div class="error-message">
                  {state.error}
                </div>
              </Show>
            </div>

            {/* Recent Projects Section */}
            <Show when={filteredRecentProjects().length > 0 || isLoadingRecent()}>
              <div class="section">
                <h3 class="section-title">Recent projects</h3>
                <div class="folder-list">
                  <Show 
                    when={!isLoadingRecent()} 
                    fallback={<div class="loading-text">Loading...</div>}
                  >
                    <For each={filteredRecentProjects()}>
                      {(project) => (
                        <div 
                          class="folder-item"
                          onClick={() => openProjectByPath(project.path)}
                        >
                          <span class="folder-icon">📁</span>
                          <span class="folder-path">{project.path}</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Quick Access Section */}
            <div class="section">
              <h3 class="section-title">Open project</h3>
              <div class="folder-list">
                <For each={filteredQuickAccess()}>
                  {(folder) => (
                    <div 
                      class="folder-item"
                      onClick={() => openProjectByPath(folder.path)}
                    >
                      <span class="folder-icon">{folder.icon}</span>
                      <span class="folder-path">{folder.path}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Search Results Section */}
            <Show when={searchQuery() && searchResults().length > 0}>
              <div class="section">
                <h3 class="section-title">Search results</h3>
                <div class="folder-list">
                  <For each={searchResults().slice(0, 5)}>
                    {(result) => (
                      <div 
                        class="folder-item"
                        onClick={() => openProjectByPath(result.path)}
                      >
                        <span class="folder-icon">📁</span>
                        <div class="folder-info">
                          <span class="folder-name">{result.name}</span>
                          <span class="folder-path-small">{result.relative_path}</span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default OpenProjectDialog;
