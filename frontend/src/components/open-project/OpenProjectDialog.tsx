/**
 * OpenProjectDialog 主组件
 * 项目打开对话框容器，包含路径输入和最近项目列表
 */

import { Component, Show, For, createEffect, createSignal } from 'solid-js';
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
      state.resetState();
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

  const handleProjectOpen = async (path: string) => {
    await state.openProjectByPath(path);
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
              🗂️ 打开项目
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
            {/* 左侧：项目列表 */}
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

              {/* 项目列表 */}
              <div class="project-list-container">
                <h3 class="project-list-title">项目列表</h3>
                
                <Show
                  when={!state.isLoadingRecent}
                  fallback={<LoadingState message="加载项目列表..." />}
                >
                  <Show
                    when={state.recentProjects.length > 0}
                    fallback={<div class="no-projects">暂无项目</div>}
                  >
                    <div class="project-list">
                      <For each={state.recentProjects}>
                        {(project) => (
                          <RecentProjectCard
                            project={project}
                            isSelected={state.selectedProject()?.id === project.id}
                            onClick={() => {
                              state.setSelectedProject(project);
                              handleProjectOpen(project.path);
                            }}
                            disabled={state.state.isLoading}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>

            {/* 右侧：项目详情 */}
            <div class="open-project-right">
              <Show
                when={state.selectedProject()}
                fallback={
                  <div class="project-detail-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>选择项目查看详情</p>
                  </div>
                }
              >
                {(project) => (
                  <div class="project-detail">
                    <div class="project-detail-header">
                      <div class="project-detail-icon">
                        {project().name.charAt(0).toUpperCase()}
                      </div>
                      <div class="project-detail-title">
                        <h3>{project().name}</h3>
                        <span class="project-detail-type">{project().type || '项目'}</span>
                      </div>
                    </div>
                    
                    <div class="project-detail-info">
                      <div class="detail-row">
                        <span class="detail-label">路径</span>
                        <span class="detail-value" title={project().path}>{project().path}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">最后打开</span>
                        <span class="detail-value">{new Date(project().last_opened_at).toLocaleString('zh-CN')}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">项目ID</span>
                        <span class="detail-value">{project().id}</span>
                      </div>
                    </div>

                    <button
                      class="project-detail-open-btn"
                      onClick={() => handleProjectOpen(project().path)}
                      disabled={state.state.isLoading}
                    >
                      {state.state.isLoading ? '打开中...' : '打开此项目'}
                    </button>
                  </div>
                )}
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="open-project-footer">
            <button
              class="open-project-cancel-btn"
              onClick={handleClose}
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
