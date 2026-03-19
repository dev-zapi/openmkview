import { Component } from 'solid-js';
import styles from './styles.module.css';

export interface BreadcrumbBarProps {
  projectName: string;
  filePath: string;
  isFavorite?: boolean;
  onNavigate: (path: string) => void;
  onFavoriteToggle: () => void;
  onMenuClick?: () => void;  // Mobile menu button callback
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

  const handleProjectClick = () => {
    props.onNavigate('');
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
        <button
          class={styles.backButton}
          onClick={handleProjectClick}
          title="返回项目根目录"
        >
          🔙
        </button>
        <span
          class={styles.projectName}
          onClick={handleProjectClick}
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
