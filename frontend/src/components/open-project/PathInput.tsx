/**
 * PathInput 组件 - 路径输入框
 * 
 * 功能：
 * - 实时检测路径类型（absolute/relative/fuzzy）
 * - 路径类型提示标签（带颜色和图标）
 * - 深度提示（深度 ≤ 2）
 * - 模糊搜索候选列表下拉框
 * - 输入框和提交按钮
 */

import { Component, createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import { projectClient } from '../../api/client';
import type { PathType, PathCandidate } from '../../types/openProject';

export interface PathInputProps {
  /** 输入框占位符 */
  placeholder?: string;
  /** 路径提交回调 */
  onSubmit: (path: string) => void;
  /** 初始值 */
  initialValue?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 检测路径类型（本地逻辑，不调用 API）
 */
function detectPathType(input: string): PathType | null {
  if (!input || input.trim() === '') {
    return null;
  }
  
  const trimmed = input.trim();
  
  // 绝对路径：以 / 开头（Unix）或匹配 Windows 盘符格式
  if (trimmed.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(trimmed)) {
    return 'absolute';
  }
  
  // 包含路径分隔符的是相对路径
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'relative';
  }
  
  // 没有分隔符的是模糊搜索
  return 'fuzzy';
}

/**
 * 计算路径深度
 */
function calculateDepth(input: string): number {
  if (!input || input.trim() === '') {
    return 0;
  }
  
  const trimmed = input.trim();
  const parts = trimmed.split(/[/\\]/).filter(p => p.length > 0);
  
  return parts.length;
}

/**
 * 路径类型标签配置
 */
const pathTypeConfig: Record<PathType, { label: string; colorClass: string; icon: string }> = {
  absolute: {
    label: '绝对路径',
    colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    icon: '📍',
  },
  relative: {
    label: '相对路径',
    colorClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    icon: '📂',
  },
  fuzzy: {
    label: '模糊搜索',
    colorClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    icon: '🔍',
  },
};

const PathInput: Component<PathInputProps> = (props) => {
  // 输入值
  const [input, setInput] = createSignal(props.initialValue || '');
  
  // 候选列表
  const [candidates, setCandidates] = createSignal<PathCandidate[]>([]);
  
  // 是否显示候选列表
  const [showCandidates, setShowCandidates] = createSignal(false);
  
  // 加载状态
  const [isLoading, setIsLoading] = createSignal(false);
  
  // 错误信息
  const [error, setError] = createSignal<string | null>(null);

  // 计算路径类型
  const pathType = createMemo(() => detectPathType(input()));
  
  // 计算路径深度
  const depth = createMemo(() => calculateDepth(input()));
  
  // 是否显示深度提示
  const showDepthHint = createMemo(() => depth() > 0 && depth() <= 2);
  
  // 是否是模糊搜索模式
  const isFuzzyMode = createMemo(() => pathType() === 'fuzzy');

  // 输入变化时处理
  createEffect(() => {
    const value = input();
    const type = pathType();
    
    // 重置错误
    setError(null);
    
    // 模糊搜索模式下调用 API 获取候选
    if (type === 'fuzzy' && value.trim().length > 0) {
      setIsLoading(true);
      
      // 防抖处理
      const timeoutId = setTimeout(async () => {
        try {
          const result = await projectClient.resolvePath(value);
          
          if (result.success && result.candidates.length > 0) {
            setCandidates(result.candidates);
            setShowCandidates(true);
          } else {
            setCandidates([]);
            setShowCandidates(false);
          }
        } catch (err) {
          console.error('Failed to resolve path:', err);
          setCandidates([]);
          setShowCandidates(false);
        } finally {
          setIsLoading(false);
        }
      }, 150); // 150ms 防抖
      
      return () => clearTimeout(timeoutId);
    } else {
      setCandidates([]);
      setShowCandidates(false);
    }
  });

  // 处理输入变化
  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    setInput(e.currentTarget.value);
  };

  // 处理提交
  const handleSubmit = () => {
    const value = input().trim();
    if (value && !props.disabled && !props.loading) {
      // 如果有候选列表且正在显示，选择第一个
      if (isFuzzyMode() && candidates().length > 0 && showCandidates()) {
        const firstCandidate = candidates()[0];
        setInput(firstCandidate.path);
        setShowCandidates(false);
        props.onSubmit(firstCandidate.path);
      } else {
        props.onSubmit(value);
      }
    }
  };

  // 处理候选选择
  const handleCandidateClick = (candidate: PathCandidate) => {
    setInput(candidate.path);
    setShowCandidates(false);
    props.onSubmit(candidate.path);
  };

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setShowCandidates(false);
    }
  };

  // 处理失焦（延迟关闭下拉框以允许点击）
  const handleBlur = () => {
    setTimeout(() => {
      setShowCandidates(false);
    }, 200);
  };

  // 获取路径类型标签配置
  const getPathTypeConfig = () => {
    const type = pathType();
    return type ? pathTypeConfig[type] : null;
  };

  return (
    <div class="path-input-container w-full">
      {/* 路径类型标签 */}
      <Show when={getPathTypeConfig()}>
        {(config) => (
          <div class="flex items-center gap-2 mb-2">
            <span
              class={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config().colorClass}`}
            >
              <span>{config().icon}</span>
              <span>{config().label}</span>
            </span>
            
            {/* 深度提示 */}
            <Show when={showDepthHint()}>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                深度 ≤ 2
              </span>
            </Show>
            
            {/* 加载指示器 */}
            <Show when={isLoading()}>
              <span class="text-xs text-gray-400 animate-pulse">
                搜索中...
              </span>
            </Show>
          </div>
        )}
      </Show>

      {/* 输入框区域 */}
      <div class="relative">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              value={input()}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              disabled={props.disabled || props.loading}
              placeholder={props.placeholder || '输入项目路径...'}
              class="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     placeholder:text-gray-400 dark:placeholder:text-gray-500
                     text-gray-900 dark:text-gray-100"
            />
            
            {/* 候选列表下拉框 */}
            <Show when={showCandidates() && candidates().length > 0}>
              <div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                <For each={candidates()}>
                  {(candidate, index) => (
                    <button
                      type="button"
                      onClick={() => handleCandidateClick(candidate)}
                      class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 
                             border-b border-gray-100 dark:border-gray-700 last:border-b-0
                             focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700/50"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-gray-500 dark:text-gray-400">📁</span>
                          <span class="font-medium text-gray-900 dark:text-gray-100">
                            {candidate.name}
                          </span>
                        </div>
                        <Show when={candidate.depth <= 2}>
                          <span class="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            浅层
                          </span>
                        </Show>
                      </div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        {candidate.relative_path}
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          
          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input().trim() || props.disabled || props.loading}
            class="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed
                   rounded-lg transition-colors duration-150
                   flex items-center gap-2"
          >
            <Show when={props.loading} fallback={
              <>
                <span>打开</span>
                <span>→</span>
              </>
            }>
              <span class="animate-spin">⏳</span>
              <span>加载中</span>
            </Show>
          </button>
        </div>
      </div>
      
      {/* 错误提示 */}
      <Show when={error()}>
        <div class="mt-2 text-sm text-red-600 dark:text-red-400">
          {error()}
        </div>
      </Show>
    </div>
  );
};

export default PathInput;
export { detectPathType, calculateDepth };
