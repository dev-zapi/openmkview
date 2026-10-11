import { Component, createEffect, Show } from 'solid-js';
import styles from './styles.module.css';
import { Button, Input } from '../ui';

export interface SearchBoxProps {
  isOpen: boolean;
  query: string;
  placeholder?: string;
  resultCount?: number;
  currentResult?: number;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onNextResult: () => void;
  onPrevResult: () => void;
  /** Optional ref callback for the search input (used to re-focus via Ctrl+F). */
  inputRef?: (el: HTMLInputElement) => void;
}

const searchIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const chevronUpIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const chevronDownIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const closeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const SearchBox: Component<SearchBoxProps> = (props) => {
  let inputEl: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.isOpen && inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  });

  const hasQuery = () => props.query.trim().length > 0;
  const hasResults = () => (props.resultCount ?? 0) > 0;

  const setInputRef = (el: HTMLInputElement) => {
    inputEl = el;
    props.inputRef?.(el);
  };

  // NOTE: must use <Show> rather than an early `return null` — a Solid component
  // body runs once, so an early return on `props.isOpen` would freeze the box closed.
  return (
    <Show when={props.isOpen}>
      <div class={styles.searchBox} role="search">
        <div class="relative min-w-0 flex-1">
          <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {searchIcon}
          </span>
          <Input
            ref={setInputRef}
            type="text"
            class={styles.searchInput}
            placeholder={props.placeholder || '搜索内容...'}
            value={props.query}
            onInput={(e) => props.onQueryChange(e.currentTarget.value)}
          />
        </div>
        <span class="w-14 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
          {hasResults() ? `${props.currentResult || 0}/${props.resultCount}` : hasQuery() ? '无结果' : ''}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class={styles.iconButton}
          disabled={!hasResults()}
          onClick={props.onPrevResult}
          title="上一个 (Shift+Enter)"
          aria-label="上一个匹配"
        >
          {chevronUpIcon}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class={styles.iconButton}
          disabled={!hasResults()}
          onClick={props.onNextResult}
          title="下一个 (Enter)"
          aria-label="下一个匹配"
        >
          {chevronDownIcon}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class={styles.iconButton}
          onClick={props.onClose}
          title="关闭 (ESC)"
          aria-label="关闭搜索"
        >
          {closeIcon}
        </Button>
      </div>
    </Show>
  );
};
