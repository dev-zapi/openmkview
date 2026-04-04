/**
 * OpenProjectDialog 状态管理 Hook
 * 管理对话框状态、搜索查询和项目打开流程
 */

import { createSignal, createResource, createEffect, batch } from 'solid-js';
import type {
  OpenProjectState,
  PathCandidate,
  RecentProject,
} from '../../../types/openProject';
import {
  resolvePath,
  openProject,
  getRecentProjects,
} from '../../../api/client';

/** 初始状态 */
const createInitialState = (): OpenProjectState => ({
  isOpen: false,
  input: '',
  candidates: [],
  selectedIndex: -1,
  isLoading: false,
  error: null,
});

export interface UseOpenProjectReturn {
  /** 当前状态 */
  state: OpenProjectState;
  /** 搜索查询字符串 */
  searchQuery: () => string;
  /** 搜索结果 */
  searchResults: () => PathCandidate[];
  /** 是否正在搜索 */
  isSearching: () => boolean;
  /** 最近项目列表 */
  recentProjects: () => RecentProject[];
  /** 是否正在加载最近项目 */
  isLoadingRecent: () => boolean;
  /** 设置搜索查询 */
  setSearchQuery: (query: string) => void;
  /** 通过路径直接打开项目 */
  openProjectByPath: (path: string) => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
}

export function useOpenProject(
  isOpen: () => boolean,
  onProjectOpened: (project: RecentProject) => void
): UseOpenProjectReturn {
  // 本地状态管理
  const [state, setState] = createSignal<OpenProjectState>(createInitialState());
  
  // 搜索查询
  const [searchQuery, setSearchQuery] = createSignal('');
  
  // 获取最近项目列表
  const [recentProjectsResource] = createResource(
    () => isOpen() ? 'recent' : null,
    async () => {
      try {
        return await getRecentProjects();
      } catch (err) {
        console.error('Failed to get recent projects:', err);
        return { projects: [], total: 0 };
      }
    },
    { initialValue: { projects: [], total: 0 } }
  );

  // 搜索结果资源（基于搜索查询）
  const [searchResultsResource] = createResource(
    () => {
      // 只在对话框打开且有搜索内容时触发
      if (!isOpen() || !searchQuery().trim()) return null;
      return searchQuery().trim();
    },
    async (query) => {
      try {
        const result = await resolvePath(query);
        return result.candidates || [];
      } catch (err) {
        console.error('Search failed:', err);
        return [];
      }
    },
    { initialValue: [] }
  );

  // 派生状态 - 使用 getter 函数
  const recentProjects = () => recentProjectsResource()?.projects ?? [];
  const isLoadingRecent = () => recentProjectsResource.loading;
  const searchResults = () => searchResultsResource() || [];
  const isSearching = () => searchResultsResource.loading;

  /**
   * 验证并打开项目
   */
  const openProjectByPath = async (path: string) => {
    if (!path.trim()) {
      setState(prev => ({ ...prev, error: '请输入项目路径' }));
      return;
    }

    batch(() => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    });

    try {
      // 打开项目（后端会自动验证路径）
      const result = await openProject(path.trim());
      if (result.success && result.project) {
        batch(() => {
          setState(prev => ({ ...prev, isLoading: false }));
        });
        onProjectOpened(result.project);
      } else {
        batch(() => {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: result.error || '打开项目失败',
          }));
        });
      }
    } catch (err) {
      batch(() => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : '打开项目时发生错误',
        }));
      });
    }
  };

  /**
   * 清除错误信息
   */
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    get state() { return state(); },
    searchQuery,
    searchResults,
    isSearching,
    recentProjects,
    isLoadingRecent,
    setSearchQuery,
    openProjectByPath,
    clearError,
  };
}
