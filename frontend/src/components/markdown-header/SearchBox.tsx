import { Component, createEffect } from 'solid-js';
import styles from './styles.module.css';

export interface SearchBoxProps {
  isOpen: boolean;
  query: string;
  resultCount?: number;
  currentResult?: number;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onNextResult: () => void;
  onPrevResult: () => void;
}

export const SearchBox: Component<SearchBoxProps> = (props) => {
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.isOpen && inputRef) {
      inputRef.focus();
      inputRef.select();
    }
  });

  if (!props.isOpen) {
    return null;
  }

  return (
    <div class={styles.searchBox}>
      <div class={styles.searchInputWrapper}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text); opacity: 0.5;">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          class={styles.searchInput}
          placeholder="搜索文档内容..."
          value={props.query}
          onInput={(e) => props.onQueryChange(e.currentTarget.value)}
        />
        {props.resultCount !== undefined && props.resultCount > 0 && (
          <div class={styles.searchResults}>
            <button
              class={styles.resultButton}
              onClick={props.onPrevResult}
              title="上一个 (Shift+Enter)"
            >
              ↑
            </button>
            <span class={styles.resultCount}>
              {props.currentResult || 0}/{props.resultCount}
            </span>
            <button
              class={styles.resultButton}
              onClick={props.onNextResult}
              title="下一个 (Enter)"
            >
              ↓
            </button>
          </div>
        )}
        {props.resultCount === 0 && props.query && (
          <span style={{ color: 'var(--color-text)', opacity: 0.5, 'font-size': '12px' }}>未找到</span>
        )}
        <button class={styles.closeButton} onClick={props.onClose} title="关闭 (ESC)">
          ✕
        </button>
      </div>
    </div>
  );
};
