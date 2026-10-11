import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import styles from './styles.module.css';
import { DocumentTitleBar } from './DocumentTitleBar';
import { SearchBox } from './SearchBox';
import type { TabType } from './ViewTabs';
import type { FileType } from '../../types';
import { exportDocument } from '../../utils/markdownExport';

export interface MarkdownHeaderProps {
  fileName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: TabType;
  isOutlineOpen: boolean;
  outlineCount: number;
  content: string;
  fileType?: FileType;
  isSearchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  currentSearchResult: number;
  onTabChange: (tab: TabType) => void;
  onOutlineToggle: () => void;
  onSearchClick: () => void;
  onSearchClose: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  isDirty?: boolean;
  onSave?: () => void;
  saving?: boolean;
  /** Render the header in compact mobile mode. */
  mobile?: boolean;
  /** Hamburger menu click handler (mobile mode only). */
  onMenuClick?: () => void;
}

export const MarkdownHeader: Component<MarkdownHeaderProps> = (props) => {
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [toast, setToast] = createSignal<{ message: string; type: 'success' | 'error' } | null>(null);
  let searchInputEl: HTMLInputElement | undefined;

  const isDocumentFile = () => props.fileType === 'markdown' || props.fileType === 'html';
  const canSearch = () => isDocumentFile() && props.activeTab !== 'diff';
  const usesInlineSearch = () => canSearch() && props.activeTab !== 'edit';
  const searchButtonTitle = () => {
    if (!isDocumentFile()) return '当前视图不支持搜索';
    if (props.activeTab === 'edit') return '打开编辑器搜索';
    if (props.activeTab === 'preview') return '搜索预览内容';
    if (props.activeTab === 'source') return '搜索源码内容';
    return 'Diff 视图暂不支持搜索';
  };
  const searchPlaceholder = () => (props.activeTab === 'source' ? '搜索源码内容...' : '搜索预览内容...');

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(props.content);
      setToast({ message: 'Copied to clipboard', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setToast({ message: 'Failed to copy', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleExportClick = (format: 'pdf' | 'html' | 'md') => {
    const docType = props.fileType === 'html' ? 'html' : 'markdown';
    exportDocument(docType, props.fileName, props.content, format);
    const messages: Record<typeof format, string> = {
      pdf: 'Exporting PDF...',
      html: 'HTML downloaded',
      md: 'Markdown downloaded',
    };
    setToast({ message: messages[format], type: 'success' });
    setTimeout(() => setToast(null), 2000);
  };

  const handleFullscreenToggle = () => {
    if (!isFullscreen()) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+F 或 Cmd+F 打开搜索（已打开时重新聚焦输入框）
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (!canSearch()) {
        return;
      }

      e.preventDefault();
      if (usesInlineSearch() && props.isSearchOpen) {
        searchInputEl?.focus();
        searchInputEl?.select();
        return;
      }
      props.onSearchClick();
    }
    // ESC 关闭搜索
    if (e.key === 'Escape' && props.isSearchOpen) {
      e.preventDefault();
      props.onSearchClose();
    }
    // Enter 查找下一个
    if (e.key === 'Enter' && usesInlineSearch() && props.isSearchOpen) {
      e.preventDefault();
      if (e.shiftKey) {
        props.onSearchPrev();
      } else {
        props.onSearchNext();
      }
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  return (
    <header class={styles.markdownHeader}>
      <SearchBox
        isOpen={usesInlineSearch() && props.isSearchOpen}
        query={props.searchQuery}
        placeholder={searchPlaceholder()}
        resultCount={props.searchResultCount}
        currentResult={props.currentSearchResult}
        onQueryChange={props.onSearchQueryChange}
        onClose={props.onSearchClose}
        onNextResult={props.onSearchNext}
        onPrevResult={props.onSearchPrev}
        inputRef={(el) => (searchInputEl = el)}
      />
      <DocumentTitleBar
        fileName={props.fileName}
        lastModified={props.lastModified}
        fileSize={props.fileSize}
        activeTab={props.activeTab}
        outlineCount={props.outlineCount}
        isOutlineOpen={props.isOutlineOpen}
        isFullscreen={isFullscreen()}
        fileType={props.fileType}
        onTabChange={props.onTabChange}
        onOutlineToggle={props.onOutlineToggle}
        onFullscreenToggle={handleFullscreenToggle}
        onSearchClick={props.onSearchClick}
        isSearchActive={usesInlineSearch() && props.isSearchOpen}
        searchDisabled={!canSearch()}
        searchButtonTitle={searchButtonTitle()}
        onCopyClick={handleCopyClick}
        onExportClick={handleExportClick}
        isDirty={props.isDirty}
        onSave={props.onSave}
        saving={props.saving}
        mobile={props.mobile}
        onMenuClick={props.onMenuClick}
      />
      {toast() && (
        <div class={`${styles.toast} ${styles[toast()!.type]}`}>
          {toast()!.message}
        </div>
      )}
    </header>
  );
};
