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
  onTabChange: (tab: TabType) => void;
  onOutlineToggle: () => void;
  isDirty?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

export const MarkdownHeader: Component<MarkdownHeaderProps> = (props) => {
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<number>(0);
  const [currentResult, setCurrentResult] = createSignal<number>(0);
  const [toast, setToast] = createSignal<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSearchClick = () => {
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults(0);
    setCurrentResult(0);
  };

  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = props.content.match(regex);
      setSearchResults(matches ? matches.length : 0);
      setCurrentResult(matches && matches.length > 0 ? 1 : 0);
    } else {
      setSearchResults(0);
      setCurrentResult(0);
    }
  };

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
      e.preventDefault();
      setIsSearchOpen(true);
    }
    // ESC 关闭搜索
    if (e.key === 'Escape' && isSearchOpen()) {
      e.preventDefault();
      handleCloseSearch();
    }
    // Enter 查找下一个
    if (e.key === 'Enter' && isSearchOpen()) {
      if (e.shiftKey) {
        setCurrentResult((prev) => Math.max(prev - 1, 1));
      } else {
        setCurrentResult((prev) => Math.min(prev + 1, searchResults()));
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
        isOpen={isSearchOpen()}
        query={searchQuery()}
        resultCount={searchResults()}
        currentResult={currentResult()}
        onQueryChange={handleQueryChange}
        onClose={handleCloseSearch}
        onNextResult={() => setCurrentResult((prev) => Math.min(prev + 1, searchResults()))}
        onPrevResult={() => setCurrentResult((prev) => Math.max(prev - 1, 1))}
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
        onSearchClick={handleSearchClick}
        onCopyClick={handleCopyClick}
        onExportClick={handleExportClick}
        isDirty={props.isDirty}
        onSave={props.onSave}
        saving={props.saving}
      />
      {toast() && (
        <div class={`${styles.toast} ${styles[toast()!.type]}`}>
          {toast()!.message}
        </div>
      )}
    </header>
  );
};
