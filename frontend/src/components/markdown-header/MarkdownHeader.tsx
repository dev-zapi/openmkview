import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import styles from './styles.module.css';
import { DocumentTitleBar } from './DocumentTitleBar';
import { SearchBox } from './SearchBox';

export interface MarkdownHeaderProps {
  fileName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: 'preview' | 'source' | 'diff';
  isOutlineOpen: boolean;
  outlineCount: number;
  content: string;
  onTabChange: (tab: 'preview' | 'source' | 'diff') => void;
  onOutlineToggle: () => void;
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
      setToast({ message: '已复制到剪贴板', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      setToast({ message: '复制失败', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleExportClick = (format: 'pdf' | 'md') => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = props.fileName.replace(/\.[^/.]+$/, '');
    
    const markdownToHtml = (markdown: string): string => {
      return markdown
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
        .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
        .replace(/^\u003e (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\n/g, '<br />');
    };
    
    switch (format) {
      case 'pdf':
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const htmlBody = markdownToHtml(props.content);
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${props.fileName}</title>
              <style>
                body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }
                h1, h2, h3, h4, h5, h6 { color: #333; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
              </style>
            </head>
            <body>
              ${htmlBody}
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
        setToast({ message: 'PDF 导出中...', type: 'success' });
        break;
        
      case 'md':
        downloadFile(props.content, `${baseName}_${timestamp}.md`, 'text/markdown');
        setToast({ message: 'Markdown 已下载', type: 'success' });
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

  onMount(() => {
    const handleOpenSearch = () => {
      setIsSearchOpen(true);
    };
    document.addEventListener('openSearch', handleOpenSearch);
    
    onCleanup(() => {
      document.removeEventListener('openSearch', handleOpenSearch);
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
        onTabChange={props.onTabChange}
        onOutlineToggle={props.onOutlineToggle}
        onFullscreenToggle={handleFullscreenToggle}
        onSearchClick={handleSearchClick}
        onCopyClick={handleCopyClick}
        onExportClick={handleExportClick}
      />
      {toast() && (
        <div class={`${styles.toast} ${styles[toast()!.type]}`}>
          {toast()!.message}
        </div>
      )}
    </header>
  );
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
      setToast({ message: '已复制到剪贴板', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      setToast({ message: '复制失败', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleExportClick = (format: 'pdf' | 'md') => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = props.fileName.replace(/\.[^/.]+$/, '');
    
    const markdownToHtml = (markdown: string): string => {
      return markdown
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
        .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
        .replace(/^\u003e (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\n/g, '<br />');
    };
    
    switch (format) {
      case 'pdf':
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const htmlBody = markdownToHtml(props.content);
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${props.fileName}</title>
              <style>
                body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }
                h1, h2, h3, h4, h5, h6 { color: #333; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
              </style>
            </head>
            <body>
              ${htmlBody}
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
        setToast({ message: 'PDF 导出中...', type: 'success' });
        break;
        
      case 'md':
        downloadFile(props.content, `${baseName}_${timestamp}.md`, 'text/markdown');
        setToast({ message: 'Markdown 已下载', type: 'success' });
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

  onMount(() => {
    const handleOpenSearch = () => {
      setIsSearchOpen(true);
    };
    document.addEventListener('openSearch', handleOpenSearch);
    
    onCleanup(() => {
      document.removeEventListener('openSearch', handleOpenSearch);
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
        onTabChange={props.onTabChange}
        onOutlineToggle={props.onOutlineToggle}
        onFullscreenToggle={handleFullscreenToggle}
        onSearchClick={handleSearchClick}
        onCopyClick={handleCopyClick}
        onExportClick={handleExportClick}
      />
      {toast() && (
        <div class={`${styles.toast} ${styles[toast()!.type]}`}>
          {toast()!.message}
        </div>
      )}
    </header>
  );
};
