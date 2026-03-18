import { Component } from 'solid-js';
import styles from './styles.module.css';
import { ViewTabs } from './ViewTabs';

export interface DocumentTitleBarProps {
  fileName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: 'preview' | 'source' | 'diff';
  onTabChange: (tab: 'preview' | 'source' | 'diff') => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '刚刚';
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}分钟前`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}小时前`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}天前`;
  }
  return date.toLocaleDateString('zh-CN');
};

const getFileIcon = (fileName: string): string => {
  if (fileName.endsWith('.md') || fileName.endsWith('.mdx')) {
    return '📄';
  }
  if (fileName.endsWith('.txt')) {
    return '📝';
  }
  if (fileName.endsWith('.json')) {
    return '📋';
  }
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js')) {
    return '📜';
  }
  return '📄';
};

export const DocumentTitleBar: Component<DocumentTitleBarProps> = (props) => {
  const formattedSize = () =>
    props.fileSize !== undefined ? formatFileSize(props.fileSize) : '';

  const formattedTime = () =>
    props.lastModified ? formatTimeAgo(props.lastModified) : '';

  return (
    <div class={styles.documentTitleBar}>
      <div class={styles.documentLeft}>
        <div class={styles.documentTitle}>
          <span class={styles.fileIcon}>{getFileIcon(props.fileName)}</span>
          <span class={styles.fileName}>{props.fileName}</span>
        </div>
        <div class={styles.documentMeta}>
          {formattedTime() && <span>Modified {formattedTime()}</span>}
          {formattedTime() && formattedSize() && <span class={styles.metaSeparator}>•</span>}
          {formattedSize() && <span>{formattedSize()}</span>}
        </div>
      </div>
      <div class={styles.documentRight}>
        <ViewTabs activeTab={props.activeTab} onTabChange={props.onTabChange} />
      </div>
    </div>
  );
};
