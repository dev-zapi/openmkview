import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import styles from './styles.module.css';
import { BreadcrumbBar } from './BreadcrumbBar';
import { DocumentTitleBar } from './DocumentTitleBar';
import { ActionToolbar } from './ActionToolbar';
import { SearchBox } from './SearchBox';

export interface MarkdownHeaderProps {
  fileName: string;
  filePath: string;
  projectName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: 'preview' | 'source' | 'diff';
  isOutlineOpen: boolean;
  outlineCount: number;
  isFavorite?: boolean;
  content: string;  // 用于复制功能
  htmlContent?: string; // 用于导出 HTML
  onTabChange: (tab: 'preview' | 'source' | 'diff') => void;
  onOutlineToggle: () => void;
  onNavigate: (path: string) => void;
  onFavoriteToggle?: () => void;
  onMenuClick?: () => void;  // Mobile menu button callback
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
      // 简单的文本搜索计数
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

  const handleExportClick = (format: 'pdf' | 'html' | 'md') => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = props.fileName.replace(/\.[^/.]+$/, '');
    
    switch (format) {
      case 'pdf':
        // 使用浏览器打印功能导出PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
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
              ${props.htmlContent || `<pre>${escapeHtml(props.content)}</pre>`}
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
        setToast({ message: 'PDF 导出中...', type: 'success' });
        break;
        
      case 'html':
        // 导出为 HTML 文件
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${props.fileName}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    h1, h2, h3, h4, h5, h6 { color: #222; margin-top: 24px; margin-bottom: 16px; }
    p { margin-bottom: 16px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; padding-left: 16px; margin-left: 0; color: #666; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  ${props.htmlContent || `<pre>${escapeHtml(props.content)}</pre>`}
</body>
</html>`;
        downloadFile(htmlContent, `${baseName}_${timestamp}.html`, 'text/html');
        setToast({ message: 'HTML 已下载', type: 'success' });
        break;
        
      case 'md':
        // 导出原始 Markdown 文件
        downloadFile(props.content, `${baseName}_${timestamp}.md`, 'text/markdown');
        setToast({ message: 'Markdown 已下载', type: 'success' });
        break;
    }
    
    setTimeout(() => setToast(null), 2000);
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  // 监听打开搜索事件
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
      <BreadcrumbBar
        projectName={props.projectName}
        filePath={props.filePath}
        isFavorite={props.isFavorite}
        onNavigate={props.onNavigate}
        onFavoriteToggle={props.onFavoriteToggle || (() => {})}
        onMenuClick={props.onMenuClick}
      />
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
        onTabChange={props.onTabChange}
      />
      <ActionToolbar
        outlineCount={props.outlineCount}
        isOutlineOpen={props.isOutlineOpen}
        isFullscreen={isFullscreen()}
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
