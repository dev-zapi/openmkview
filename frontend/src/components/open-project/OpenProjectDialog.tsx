/**
 * OpenProjectDialog 主组件
 * 项目打开对话框容器，包含路径输入和最近项目列表
 */

import { Component, Show, For, createEffect } from 'solid-js';
import { useOpenProject } from './hooks/useOpenProject';
import PathInput from './PathInput';
import RecentProjectCard from './RecentProjectCard';
import type { RecentProject } from '../../types/openProject';
import './OpenProjectDialog.css';

export interface OpenProjectDialogProps {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 项目成功打开后的回调 */
  onProjectOpened: (project: RecentProject) => void;
}

/** 加载状态组件 */
const LoadingState: Component<{ message?: string }> = (props) => (
  <div class="open-project-loading">
    <div class="open-project-spinner"></div>
    <span>{props.message || '加载中...'}</span>
  </div>
);

/** 错误状态组件 */
const ErrorState: Component<{ message: string; onClose?: () => void }> = (props) => (
  <div class="open-project-error">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>{props.message}</span>
    {props.onClose && (
      <button class="error-close-btn" onClick={props.onClose}>
        关闭
      </button>
    )}
  </div>
);

const OpenProjectDialog: Component<OpenProjectDialogProps> = (props) => {
  const state = useOpenProject(() => props.isOpen, props.onProjectOpened);

  // 当对话框关闭时重置状态
  createEffect(() => {
    if (!props.isOpen) {
      state.resetState();
    }
  });

  // 处理点击遮罩关闭
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  // 处理项目打开
  const handleProjectOpen = async (path: string) => {
    await state.openProjectByPath(path);
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="open-project-overlay"
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-project-title"
      >
        <div class="open-project-dialog">
          {/* Header */}
          <div class="open-project-header">
            <h2 id="open-project-title" class="open-project-title">
              🗂️ 打开项目
            </h2>
            <button
              class="open-project-close-btn"
              onClick={props.onClose}
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
            {/* 左侧：路径输入 */}
            <div class="open-project-left">
              <PathInput
                placeholder="输入项目路径或名称..."
                onSubmit={(path) => handleProjectOpen(path)}
                disabled={state.state.isLoading}
                loading={state.state.isLoading}
              />

              <Show when={state.state.error}>
                {(error) => (
                  <ErrorState
                    message={error()}
                    onClose={state.clearError}
                  />
                )}
              </Show>
            </div>

            {/* 右侧：最近项目 */}
            <div class="open-project-right">
              <h3 class="recent-projects-title">最近打开</h3>
              
              <Show
                when={!state.isLoadingRecent}
                fallback={<LoadingState message="加载最近项目..." />}
              >
                <Show
                  when={state.recentProjects.length > 0}
                  fallback={<div class="no-recent-projects">暂无最近项目</div>}
                >
                  <div class="recent-projects-grid">
                    <For each={state.recentProjects}>
                      {(project) => (
                        <RecentProjectCard
                          project={project}
                          onClick={() => handleProjectOpen(project.path)}
                          disabled={state.state.isLoading}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="open-project-footer">
            <button
              class="open-project-cancel-btn"
              onClick={props.onClose}
              disabled={state.state.isLoading}
            >
              取消
            </button>
            <button
              class="open-project-confirm-btn"
              onClick={() => state.handleOpenProject()}
              disabled={state.state.isLoading}
            >
              {state.state.isLoading ? '打开中...' : '打开项目'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default OpenProjectDialog;
