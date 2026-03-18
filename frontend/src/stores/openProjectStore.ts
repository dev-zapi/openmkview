/**
 * OpenProject Dialog 状态管理 Store
 * 管理打开项目对话框的显示状态和最近项目列表
 */

import { createStore } from 'solid-js/store';
import type { RecentProject } from '../types/openProject';

/**
 * 对话框状态接口
 */
interface OpenProjectDialogState {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 最近项目列表 */
  recentProjects: RecentProject[];
  /** 是否正在加载最近项目 */
  isLoadingRecent: boolean;
  /** 当前选中的项目路径（用于高亮） */
  selectedPath: string | null;
}

/**
 * 初始状态
 */
const initialState: OpenProjectDialogState = {
  isOpen: false,
  recentProjects: [],
  isLoadingRecent: false,
  selectedPath: null,
};

// 创建 store
const [openProjectState, setOpenProjectState] = createStore<OpenProjectDialogState>(initialState);

/**
 * OpenProject Store
 * 提供对话框状态管理和操作方法
 */
export const openProjectStore = {
  /** 当前状态 */
  get state() {
    return openProjectState;
  },

  /**
   * 打开对话框
   */
  open() {
    setOpenProjectState('isOpen', true);
  },

  /**
   * 关闭对话框
   */
  close() {
    setOpenProjectState('isOpen', false);
    // 延迟重置选中状态
    setTimeout(() => {
      setOpenProjectState('selectedPath', null);
    }, 200);
  },

  /**
   * 切换对话框显示状态
   */
  toggle() {
    setOpenProjectState('isOpen', (prev) => !prev);
  },

  /**
   * 设置最近项目列表
   */
  setRecentProjects(projects: RecentProject[]) {
    setOpenProjectState('recentProjects', projects);
  },

  /**
   * 添加一个最近项目（如果已存在则移到最前）
   */
  addRecentProject(project: RecentProject) {
    const existing = openProjectState.recentProjects.find((p) => p.id === project.id);
    if (existing) {
      // 移除旧的，添加到最前面
      const filtered = openProjectState.recentProjects.filter((p) => p.id !== project.id);
      setOpenProjectState('recentProjects', [project, ...filtered]);
    } else {
      setOpenProjectState('recentProjects', [project, ...openProjectState.recentProjects]);
    }
  },

  /**
   * 移除一个最近项目
   */
  removeRecentProject(projectId: string) {
    setOpenProjectState(
      'recentProjects',
      openProjectState.recentProjects.filter((p) => p.id !== projectId)
    );
  },

  /**
   * 设置加载状态
   */
  setLoadingRecent(loading: boolean) {
    setOpenProjectState('isLoadingRecent', loading);
  },

  /**
   * 设置当前选中的路径
   */
  setSelectedPath(path: string | null) {
    setOpenProjectState('selectedPath', path);
  },

  /**
   * 重置所有状态
   */
  reset() {
    setOpenProjectState({
      ...initialState,
      recentProjects: openProjectState.recentProjects,
    });
  },

  /**
   * 完全重置（包括最近项目列表）
   */
  resetAll() {
    setOpenProjectState(initialState);
  },
};

/**
 * Hook: 使用对话框状态
 * 返回当前是否打开和操作方法
 */
export function useOpenProjectDialog() {
  return {
    isOpen: () => openProjectState.isOpen,
    recentProjects: () => openProjectState.recentProjects,
    isLoadingRecent: () => openProjectState.isLoadingRecent,
    selectedPath: () => openProjectState.selectedPath,
    open: openProjectStore.open,
    close: openProjectStore.close,
    toggle: openProjectStore.toggle,
  };
}

export default openProjectStore;
