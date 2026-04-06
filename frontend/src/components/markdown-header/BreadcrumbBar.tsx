import { Component } from 'solid-js';
import styles from './styles.module.css';

export interface BreadcrumbBarProps {
  projectName: string;
  filePath: string;
  isFavorite?: boolean;
  isSidebarVisible?: boolean;
  onNavigate: (path: string) => void;
  onFavoriteToggle: () => void;
  onToggleSidebar?: () => void;
  onMenuClick?: () => void;
}

export const BreadcrumbBar: Component<BreadcrumbBarProps> = (props) => {
  const pathSegments = () => {
    const segments = props.filePath.split('/').filter(Boolean);
    return segments;
  };

  const handleSegmentClick = (index: number) => {
    const path = pathSegments().slice(0, index + 1).join('/');
    props.onNavigate(path);
  };

  return (
    <div class={styles.breadcrumbBar}>
      <div class={styles.breadcrumbLeft}>
        {/* Mobile menu button */}
        <button
          class={styles.menuButton}
          onClick={props.onMenuClick}
          title="菜单"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        {/* Sidebar toggle button */}
        <button
          class={`${styles.sidebarButton} ${props.isSidebarVisible ? '' : styles.sidebarHidden}`}
          onClick={props.onToggleSidebar}
          title={props.isSidebarVisible ? '隐藏文件树' : '显示文件树'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>
        <span
          class={styles.projectName}
          onClick={() => props.onNavigate('')}
          title={props.projectName}
        >
          {props.projectName}
        </span>
        {pathSegments().length > 0 && (
          <>
            <span class={styles.separator}>/</span>
            {pathSegments().map((segment, index) => (
              <>
                <span
                  class={`${styles.breadcrumbSegment} ${
                    index === pathSegments().length - 1
                      ? styles.active
                      : ''
                  }`}
                  onClick={() => handleSegmentClick(index)}
                  title={segment}
                >
                  {segment}
                </span>
                {index < pathSegments().length - 1 && (
                  <span class={styles.separator}>/</span>
                )}
              </>
            ))}
          </>
        )}
      </div>
      <div class={styles.breadcrumbRight}>
        <button
          class={styles.favoriteButton}
          onClick={props.onFavoriteToggle}
          title={props.isFavorite ? '取消收藏' : '收藏'}
        >
          {props.isFavorite ? '⭐' : '☆'}
        </button>
        <button class={styles.moreButton} title="更多操作">
          ⋯
        </button>
      </div>
    </div>
  );
};
