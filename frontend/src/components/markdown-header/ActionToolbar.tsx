import { Component, createSignal, Show } from 'solid-js';
import styles from './styles.module.css';

export interface ActionToolbarProps {
  outlineCount: number;
  isOutlineOpen: boolean;
  isFullscreen: boolean;
  onOutlineToggle: () => void;
  onFullscreenToggle: () => void;
  onSearchClick: () => void;
  onCopyClick: () => void;
  onExportClick: (format: 'pdf' | 'html' | 'md') => void;
}

export const ActionToolbar: Component<ActionToolbarProps> = (props) => {
  const [exportMenuOpen, setExportMenuOpen] = createSignal(false);

  const handleExport = (format: 'pdf' | 'html' | 'md') => {
    props.onExportClick(format);
    setExportMenuOpen(false);
  };

  return (
    <div class={styles.actionToolbar}>
      <div class={styles.toolbarLeft}>
        <button
          class={styles.toolbarButton}
          onClick={props.onSearchClick}
          title="搜索 (Ctrl+F / ⌘+F)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>搜索</span>
        </button>
        <button
          class={`${styles.toolbarButton} ${props.isOutlineOpen ? styles.active : ''}`}
          onClick={props.onOutlineToggle}
          title="大纲"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
          <span>大纲</span>
          {props.outlineCount > 0 && (
            <span class={styles.badge}>{props.outlineCount}</span>
          )}
        </button>
      </div>

      <div class={styles.toolbarDivider} />

      <div class={styles.toolbarCenter}>
        <button
          class={styles.toolbarButton}
          onClick={props.onCopyClick}
          title="复制全文"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>复制</span>
        </button>

        {/* 导出下拉菜单 */}
        <div class={styles.dropdown}>
          <button
            class={styles.toolbarButton}
            onClick={() => setExportMenuOpen(!exportMenuOpen())}
            title="导出"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>导出</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 2px;">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <Show when={exportMenuOpen()}>
            <div class={styles.dropdownMenu}>
              <button class={styles.dropdownItem} onClick={() => handleExport('pdf')}>
                <span class={styles.dropdownIcon}>📄</span>
                <span>导出为 PDF</span>
              </button>
              <button class={styles.dropdownItem} onClick={() => handleExport('html')}>
                <span class={styles.dropdownIcon}>🌐</span>
                <span>导出为 HTML</span>
              </button>
              <button class={styles.dropdownItem} onClick={() => handleExport('md')}>
                <span class={styles.dropdownIcon}>📝</span>
                <span>导出为 Markdown</span>
              </button>
            </div>
          </Show>
        </div>

        <button class={styles.toolbarButton} title="视图设置">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div class={styles.toolbarRight}>
        <button
          class={styles.toolbarButton}
          onClick={props.onFullscreenToggle}
          title={props.isFullscreen ? '退出全屏' : '全屏'}
        >
          <Show when={props.isFullscreen} fallback={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          }>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          </Show>
        </button>
      </div>
    </div>
  );
};
