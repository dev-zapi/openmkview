import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import styles from './styles.module.css';
import { DocumentTitleBar } from './DocumentTitleBar';
import { SearchBox } from './SearchBox';
import type { TabType } from './ViewTabs';

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
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = props.fileName.replace(/\.[^/.]+$/, '');

    /**
     * Escape HTML entities to prevent XSS attacks
     */
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    /**
     * Validate URL to prevent dangerous protocols (javascript:, data:, vbscript:)
     */
    const isSafeUrl = (url: string): boolean => {
      const trimmedUrl = url.trim().toLowerCase();
      // Reject dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
      for (const protocol of dangerousProtocols) {
        if (trimmedUrl.startsWith(protocol)) {
          return false;
        }
      }
      return true;
    };

    /**
     * Convert markdown to safe HTML using escape-first approach
     * This prevents XSS by escaping all content first, then applying safe transformations
     */
    const markdownToSafeHtml = (markdown: string): string => {
      // First, escape all HTML entities to neutralize any malicious content
      let escaped = escapeHtml(markdown);

      // Apply safe transformations on escaped content
      // Code blocks (already escaped, wrap in pre/code)
      escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
      // Inline code
      escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
      // Headers
      escaped = escaped.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
      escaped = escaped.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
      escaped = escaped.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
      escaped = escaped.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      escaped = escaped.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      escaped = escaped.replace(/^# (.*$)/gim, '<h1>$1</h1>');
      // Bold
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');
      // Italic
      escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
      escaped = escaped.replace(/_(.*?)_/g, '<em>$1</em>');
      // Strikethrough
      escaped = escaped.replace(/~~(.*?)~~/g, '<del>$1</del>');
      // Links - with URL validation (only allow safe URLs)
      escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        if (isSafeUrl(url)) {
          return `<a href="${escapeHtml(url)}">${text}</a>`;
        }
        // Replace dangerous links with just the text
        return text;
      });
      // Images - with URL validation (only allow safe URLs)
      escaped = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
        if (isSafeUrl(url)) {
          return `<img alt="${escapeHtml(alt)}" src="${escapeHtml(url)}" />`;
        }
        // Replace dangerous images with placeholder
        return `[Image blocked: unsafe URL]`;
      });
      // Blockquotes
      escaped = escaped.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
      // Line breaks
      escaped = escaped.replace(/\n/g, '<br />');

      return escaped;
    };

    switch (format) {
      case 'pdf':
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const safeHtmlBody = markdownToSafeHtml(props.content);
          const safeFileName = escapeHtml(props.fileName);
          // Use DOM APIs instead of document.write() for safer injection
          printWindow.document.open();
          const doc = printWindow.document;
          doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>${safeFileName}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  ${safeHtmlBody}
</body>
</html>`);
          doc.close();
          printWindow.print();
        }
        setToast({ message: 'Exporting PDF...', type: 'success' });
        break;

      case 'md':
        downloadFile(props.content, `${baseName}_${timestamp}.md`, 'text/markdown');
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
