/**
 * PathInput - 简化版路径输入框
 * 
 * 保留功能：
 * - 输入处理
 * - 防抖（可选，由父组件控制）
 * - 提交处理（Enter键）
 * - 禁用状态
 * - 加载指示器
 * 
 * 移除功能：
 * - 下拉候选列表
 * - 本地路径类型检测（移到父组件或服务层）
 * - 本地最近项目过滤
 */

import { Component, Show, createEffect, onMount } from 'solid-js';

export interface PathInputProps {
  /** 当前输入值 */
  value: string;
  /** 输入变化回调 */
  onChange: (value: string) => void;
  /** 提交回调（按Enter） */
  onSubmit: (value: string) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 是否自动聚焦 */
  autoFocus?: boolean;
}

const PathInput: Component<PathInputProps> = (props) => {
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    if (props.autoFocus && inputRef) {
      inputRef.focus();
    }
  });

  createEffect(() => {
    if (props.autoFocus && inputRef) {
      inputRef.focus();
    }
  });

  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    props.onChange(e.currentTarget.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !props.disabled && !props.loading) {
      e.preventDefault();
      props.onSubmit(props.value);
    }
  };

  return (
    <div class="path-input-wrapper">
      <div class="path-input-container">
        {/* 搜索图标 */}
        <svg 
          class="search-icon" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        
        <input
          ref={inputRef}
          type="text"
          value={props.value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={props.disabled}
          placeholder={props.placeholder || 'Search folders'}
          class="path-input"
        />
        
        {/* 加载指示器 */}
        <Show when={props.loading}>
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default PathInput;
