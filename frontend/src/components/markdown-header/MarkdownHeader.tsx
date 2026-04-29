import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import styles from './styles.module.css';
import { DocumentTitleBar } from './DocumentTitleBar';
import { SearchBox } from './SearchBox';
import type { TabType } from './ViewTabs';
import { buildMarkdownDownloadName, buildPrintableMarkdownDocument } from '../../utils/markdownExport';

export interface MarkdownHeaderProps {
  fileName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: TabType;
  isOutlineOpen: boolean;
  outlineCount: number;
  content: string;
  fileType?: 'markdown' | 'image';
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

  const canSearch = () => props.fileType === 'markdown' && props.activeTab !== 'diff';
  const usesInlineSearch = () => canSearch() && props.activeTab !== 'edit';
  const searchButtonTitle = () => {
    if (props.fileType !== 'markdown') return '当前视图不支持搜索';
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

  const handleExportClick = (format: 'pdf' | 'md') => {
    switch (format) {
      case 'pdf':
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          // Use DOM APIs instead of document.write() for safer injection
          printWindow.document.open();
          const doc = printWindow.document;
          doc.write(buildPrintableMarkdownDocument(props.fileName, props.content));
          doc.close();
          printWindow.print();
        }
        setToast({ message: 'Exporting PDF...', type: 'success' });
        break;

      case 'md':
        downloadFile(props.content, buildMarkdownDownloadName(props.fileName), 'text/markdown');
        setToast({ message: 'Markdown downloaded', type: 'success' });
        break;
    }

    setTimeout(() => setToast(null), 2000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    // Ctrl+F 或 Cmd+F 打开搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (!canSearch()) {
        return;
      }

      e.preventDefault();
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
