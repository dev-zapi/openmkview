/**
 * OpenProjectDialog 状态管理 Hook
 * 管理对话框状态、路径解析和项目打开流程
 */

import { createSignal, createResource, createEffect, batch } from 'solid-js';
import type {
  OpenProjectState,
  PathCandidate,
  RecentProject,
} from '../../../types/openProject';
import {
  resolvePath,
  validateProjectPath,
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
  /** 最近项目列表 */
  recentProjects: RecentProject[];
  /** 是否正在加载最近项目 */
  isLoadingRecent: boolean;
  /** 更新输入路径 */
  setInput: (input: string) => void;
  /** 选择候选路径 */
  selectCandidate: (index: number) => void;
  /** 打开选中的项目 */
  handleOpenProject: () => Promise<void>;
  /** 通过路径直接打开项目 */
  openProjectByPath: (path: string) => Promise<void>;
  /** 重置状态 */
  resetState: () => void;
  /** 清除错误 */
  clearError: () => void;
}

export function useOpenProject(
  isOpen: () => boolean,
  onProjectOpened: (project: RecentProject) => void
): UseOpenProjectReturn {
  // 本地状态管理
  const [state, setState] = createSignal<OpenProjectState>(createInitialState());
  
  // 获取最近项目列表
  const [recentProjectsResource, { refetch: refetchRecent }] = createResource(
    () => isOpen() ? getRecentProjects() : null,
    { initialValue: { projects: [], total: 0 } }
  );

  // 当对话框打开时刷新最近项目列表
  createEffect(() => {
    if (isOpen()) {
      refetchRecent();
    }
  });

  // 派生状态
  const recentProjects = () => recentProjectsResource()?.projects ?? [];
  const isLoadingRecent = () => recentProjectsResource.loading;

  /**
   * 更新输入路径并解析候选
   */
  const setInput = async (input: string) => {
    batch(() => {
      setState(prev => ({ ...prev, input, error: null }));
    });

    if (!input.trim()) {
      setState(prev => ({ ...prev, candidates: [], selectedIndex: -1 }));
      return;
    }

    try {
      const result = await resolvePath(input);
      batch(() => {
        setState(prev => ({
          ...prev,
          candidates: result.candidates,
          selectedIndex: result.candidates.length > 0 ? 0 : -1,
        }));
      });
    } catch (err) {
      batch(() => {
        setState(prev => ({
          ...prev,
          candidates: [],
          selectedIndex: -1,
          error: err instanceof Error ? err.message : '路径解析失败',
        }));
      });
    }
  };

  /**
   * 选择候选路径
   */
  const selectCandidate = (index: number) => {
    const candidates = state().candidates;
    if (index >= 0 && index < candidates.length) {
      batch(() => {
        setState(prev => ({
          ...prev,
          selectedIndex: index,
          input: candidates[index].path,
        }));
      });
    }
  };

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
      // 先验证路径
      const validation = await validateProjectPath(path);
      if (!validation.valid) {
        batch(() => {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: validation.error || '无效的项目路径',
          }));
        });
        return;
      }

      // 打开项目
      const result = await openProject(validation.normalized_path || path);
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
   * 处理打开项目按钮点击
   */
  const handleOpenProject = async () => {
    const currentState = state();
    let pathToOpen = currentState.input;

    // 如果有选中的候选，使用候选路径
    if (currentState.selectedIndex >= 0 && currentState.candidates.length > 0) {
      pathToOpen = currentState.candidates[currentState.selectedIndex].path;
    }

    await openProjectByPath(pathToOpen);
  };

  /**
   * 重置状态
   */
  const resetState = () => {
    setState(createInitialState());
  };

  /**
   * 清除错误信息
   */
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    get state() { return state(); },
    get recentProjects() { return recentProjects(); },
    get isLoadingRecent() { return isLoadingRecent(); },
    setInput,
    selectCandidate,
    handleOpenProject,
    openProjectByPath,
    resetState,
    clearError,
  };
}
