/**
 * PathInput 组件 - 路径输入框
 * 
 * 功能：
 * - 实时检测路径类型（absolute/relative/fuzzy）
 * - 模糊搜索候选列表下拉框
 * - 支持键盘上下导航和 Tab/Enter 补全
 */

import { Component, createSignal, createEffect, Show, For, onCleanup, createMemo } from 'solid-js';
import { projectClient } from '../../api/client';
import type { PathCandidate } from '../../types/openProject';

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
  /** 是否自动聚焦 */
  autoFocus?: boolean;
}

/**
 * 检测路径类型（本地逻辑，不调用 API）
 */
function detectPathType(input: string): 'fuzzy' | 'absolute' | 'relative' | null {
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
 * 简单防抖函数
 */
function debounce<T extends (...args: string[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: string[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}

const PathInput: Component<PathInputProps> = (props) => {
  // 输入值
  const [input, setInput] = createSignal(props.initialValue || '');
  
  // 搜索结果列表
  const [searchResults, setSearchResults] = createSignal<PathCandidate[]>([]);
  
  // 过滤后的最近列表
  const [filteredRecent, setFilteredRecent] = createSignal<Array<{name: string; path: string}>>([]);
  
  // 是否显示候选列表
  const [showCandidates, setShowCandidates] = createSignal(false);
  
  // 加载状态
  const [isLoading, setIsLoading] = createSignal(false);
  
  // 键盘选中索引（-1 表示未选中）
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  
  // 输入 ref
  let inputRef: HTMLInputElement | undefined;
  
  // 总候选数（搜索结果 + 过滤的最近）
  const totalCandidates = () => searchResults().length + filteredRecent().length;
  
  // 计算路径类型
  const pathType = createMemo(() => detectPathType(input()));
  
  // 是否是模糊搜索模式
  const isFuzzyMode = createMemo(() => pathType() === 'fuzzy');
  
  // autoFocus effect
  createEffect(() => {
    if (props.autoFocus && inputRef) {
      inputRef.focus();
    }
  });

  // 防抖搜索
  const debouncedSearch = debounce(async (query: string) => {
    if (!query.trim() || !isFuzzyMode()) {
      setSearchResults([]);
      setShowCandidates(false);
      setIsLoading(false);
      return;
    }

    try {
      const result = await projectClient.resolvePath(query);
      setSearchResults(result.candidates || []);
      
      // 过滤最近项目（最多显示5个）
      const recentStr = localStorage.getItem('openmkview-recent-projects');
      if (recentStr) {
        try {
          const recent = JSON.parse(recentStr);
          const filtered = (recent as Array<{name: string; path: string}>)
            .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
          setFilteredRecent(filtered);
        } catch {
          setFilteredRecent([]);
        }
      } else {
        setFilteredRecent([]);
      }
      
      setShowCandidates(true);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Failed to resolve path:', err);
      setSearchResults([]);
      setFilteredRecent([]);
    } finally {
      setIsLoading(false);
    }
  }, 350);

  // 输入变化时处理
  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const value = e.currentTarget.value;
    setInput(value);
    setSelectedIndex(-1);
    
    if (value.trim().length > 0) {
      setIsLoading(true);
      debouncedSearch(value);
    } else {
      setSearchResults([]);
      setFilteredRecent([]);
      setShowCandidates(false);
      setIsLoading(false);
    }
  };

  // 处理提交
  const handleSubmit = () => {
    const value = input().trim();
    if (value && !props.disabled && !props.loading) {
      // 如果有候选列表且正在显示，选择第一个或当前选中项
      if (showCandidates()) {
        const idx = selectedIndex();
        if (idx >= 0 && idx < totalCandidates()) {
          let path: string;
          if (idx < searchResults().length) {
            path = searchResults()[idx].path;
          } else {
            path = filteredRecent()[idx - searchResults().length].path;
          }
          setInput(path);
          setShowCandidates(false);
          props.onSubmit(path);
          return;
        }
      }
      props.onSubmit(value);
    }
  };

  // 处理候选选择
  const handleCandidateSelect = (path: string, name: string) => {
    setInput(name || path);
    setShowCandidates(false);
    props.onSubmit(path);
  };

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent) => {
    const total = totalCandidates();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showCandidates()) {
        setShowCandidates(true);
        setSelectedIndex(0);
      } else {
        setSelectedIndex(prev => (prev + 1) % Math.max(total, 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showCandidates()) {
        setSelectedIndex(prev => (prev <= 0 ? total - 1 : prev - 1));
      }
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (showCandidates() && total > 0) {
        e.preventDefault();
        const idx = selectedIndex() >= 0 ? selectedIndex() : 0;
        if (idx < searchResults().length) {
          const candidate = searchResults()[idx];
          setInput(candidate.path);
          setShowCandidates(false);
          props.onSubmit(candidate.path);
        } else {
          const recent = filteredRecent()[idx - searchResults().length];
          if (recent) {
            setInput(recent.path);
            setShowCandidates(false);
            props.onSubmit(recent.path);
          }
        }
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setShowCandidates(false);
      setSelectedIndex(-1);
    }
  };

  // 处理失焦（延迟关闭下拉框以允许点击）
  const handleBlur = () => {
    setTimeout(() => {
      setShowCandidates(false);
      setSelectedIndex(-1);
    }, 200);
  };

  // 处理鼠标悬停
  const handleMouseEnter = (index: number) => {
    setSelectedIndex(index);
  };

  // 计算全局索引
  const getGlobalIndex = (section: 'search' | 'recent', localIndex: number): number => {
    if (section === 'search') {
      return localIndex;
    }
    return searchResults().length + localIndex;
  };

  return (
    <div class="path-input-container w-full">
      {/* 输入框区域 */}
      <div class="relative">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input()}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onFocus={() => {
                // 聚焦时如果有内容且是模糊模式，显示候选列表
                if (input().trim().length > 0 && isFuzzyMode() && totalCandidates() > 0) {
                  setShowCandidates(true);
                }
              }}
              disabled={props.disabled || props.loading}
              placeholder={props.placeholder || '输入项目路径或名称...'}
              class="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     placeholder:text-gray-400 dark:placeholder:text-gray-500
                     text-gray-900 dark:text-gray-100 transition-all duration-150"
            />
            
            {/* 加载指示器 */}
            <Show when={isLoading()}>
              <div class="absolute right-3 top-1/2 -translate-y-1/2">
                <div class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            </Show>
            
            {/* 候选列表下拉框 - 分栏设计 */}
            <Show when={showCandidates() && totalCandidates() > 0}>
              <div class="candidate-dropdown">
                {/* 搜索结果区域 */}
                <Show when={searchResults().length > 0}>
                  <div class="search-results-section">
                    <div class="section-label">搜索结果</div>
                    <For each={searchResults().slice(0, 5)}>
                      {(candidate, index) => (
                        <div
                          class="candidate-item"
                          classList={{ 'is-selected': selectedIndex() === getGlobalIndex('search', index()) }}
                          onClick={() => handleCandidateSelect(candidate.path, candidate.name)}
                          onMouseEnter={() => handleMouseEnter(getGlobalIndex('search', index()))}
                        >
                          <div class="flex items-center gap-2">
                            <span class="text-gray-500 dark:text-gray-400">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                              </svg>
                            </span>
                            <span class="font-medium text-gray-900 dark:text-gray-100">
                              {candidate.name}
                            </span>
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400 truncate ml-6">
                            {candidate.relative_path}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                
                {/* 分隔线 */}
                <Show when={searchResults().length > 0 && filteredRecent().length > 0}>
                  <div class="section-divider"></div>
                </Show>
                
                {/* 过滤的最近项目区域 */}
                <Show when={filteredRecent().length > 0}>
                  <div class="recent-results-section">
                    <div class="section-label">最近打开</div>
                    <For each={filteredRecent()}>
                      {(recent, index) => (
                        <div
                          class="candidate-item"
                          classList={{ 'is-selected': selectedIndex() === getGlobalIndex('recent', index()) }}
                          onClick={() => handleCandidateSelect(recent.path, recent.name)}
                          onMouseEnter={() => handleMouseEnter(getGlobalIndex('recent', index()))}
                        >
                          <div class="flex items-center gap-2">
                            <span class="text-gray-500 dark:text-gray-400">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                            </span>
                            <span class="font-medium text-gray-900 dark:text-gray-100">
                              {recent.name}
                            </span>
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400 truncate ml-6">
                            {recent.path}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathInput;
export { detectPathType };
