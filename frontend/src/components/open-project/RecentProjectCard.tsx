/**
 * RecentProjectCard 组件
 * 显示最近打开的项目卡片，包含图标、名称、路径和打开时间
 */

import { Component, Show, createSignal } from 'solid-js';
import type { RecentProject } from '../../types/openProject';
import './RecentProjectCard.css';

export interface RecentProjectCardProps {
  /** 项目数据 */
  project: RecentProject;
  /** 点击回调 */
  onClick: () => void;
  /** 是否选中 */
  isSelected?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 格式化日期显示
 * - 今天：显示 "今天 HH:mm"
 * - 昨天：显示 "昨天 HH:mm"
 * - 其他：显示 "M月D日 HH:mm"
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  if (dateTime.getTime() === today.getTime()) {
    return `今天 ${timeStr}`;
  } else if (dateTime.getTime() === yesterday.getTime()) {
    return `昨天 ${timeStr}`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * 获取项目名称首字母或图标
 */
function getProjectIcon(name: string): string {
  if (!name) return '📁';
  
  // 如果是特殊项目名称，返回对应图标
  const iconMap: Record<string, string> = {
    'openmkview': '🚀',
    'frontend': '⚛️',
    'backend': '🔧',
    'docs': '📚',
    'test': '🧪',
    'tests': '🧪',
    'src': '💻',
    'source': '💻',
    'web': '🌐',
    'app': '📱',
    'mobile': '📱',
    'desktop': '🖥️',
    'server': '☁️',
    'api': '🔌',
    'cli': '⌨️',
    'config': '⚙️',
    'tools': '🛠️',
  };
  
  const lowerName = name.toLowerCase();
  if (iconMap[lowerName]) {
    return iconMap[lowerName];
  }
  
  // 返回首字母
  return '📁';
}

/**
 * 截断路径，显示最后两部分
 */
function truncatePath(path: string, maxLength: number = 35): string {
  if (!path || path.length <= maxLength) return path;
  
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return path;
  
  // 尝试显示最后两部分
  const lastTwo = parts.slice(-2).join('/');
  if (lastTwo.length <= maxLength - 3) {
    return '.../' + lastTwo;
  }
  
  // 如果还是太长，只显示最后一部分
  const lastOne = parts[parts.length - 1];
  if (lastOne.length <= maxLength - 4) {
    return '.../' + lastOne;
  }
  
  return path.slice(0, maxLength - 3) + '...';
}

const RecentProjectCard: Component<RecentProjectCardProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);
  
  const handleClick = () => {
    if (!props.disabled) {
      props.onClick();
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };
  
  return (
    <div
      class="recent-project-card"
      classList={{
        'is-selected': props.isSelected,
        'is-disabled': props.disabled,
        'is-hovered': isHovered(),
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      role="button"
      tabindex={props.disabled ? -1 : 0}
      aria-label={`打开项目 ${props.project.name}`}
      title={`${props.project.name}\n${props.project.path}\n最后打开: ${formatDate(props.project.last_opened_at)}`}
    >
      <div class="recent-project-icon">
        {getProjectIcon(props.project.name)}
      </div>
      <div class="recent-project-info">
        <div class="recent-project-name">
          {props.project.name}
        </div>
        <div class="recent-project-path" title={props.project.path}>
          {truncatePath(props.project.path)}
        </div>
        <div class="recent-project-time">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          {formatDate(props.project.last_opened_at)}
        </div>
      </div>
      <Show when={isHovered() || props.isSelected}>
        <div class="recent-project-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </Show>
    </div>
  );
};

export default RecentProjectCard;
export { formatDate, getProjectIcon, truncatePath };
