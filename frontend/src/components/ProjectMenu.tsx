import { Component, Show } from 'solid-js';
import type { RemoteGitAction } from '../utils/gitPanel';

interface ProjectMenuProps {
  isOpen: boolean;
  position: { top: number; right: number };
  gitOperation?: RemoteGitAction;
  gitUnavailable: boolean;
  pullDisabled: boolean;
  onRefresh: () => void;
  onFetch: () => void;
  onPull: () => void;
  onEdit: () => void;
  onCloseProject: () => void;
  onCloseMenu: () => void;
}

const ProjectMenu: Component<ProjectMenuProps> = (props) => {
  const gitBusy = () => Boolean(props.gitOperation);
  const fetchTitle = () => props.gitUnavailable ? 'Unavailable while offline' : undefined;
  const pullTitle = () => {
    if (props.gitUnavailable) return 'Unavailable while offline';
    if (props.pullDisabled) return 'Save or discard unsaved changes before pulling';
    return undefined;
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="menu-overlay"
        onClick={props.onCloseMenu}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          'z-index': 9998,
          background: 'transparent',
        }}
      />
      <div
        class="sidebar-header-menu-dropdown"
        role="menu"
        style={{
          position: 'absolute',
          top: `${props.position.top}px`,
          right: `${props.position.right}px`,
          'z-index': 9999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button class="menu-item" role="menuitem" onClick={props.onRefresh}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Refresh</span>
        </button>
        <div class="menu-separator" role="separator" />
        <button
          class="menu-item"
          role="menuitem"
          disabled={gitBusy() || props.gitUnavailable}
          title={fetchTitle()}
          onClick={props.onFetch}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          <span>{props.gitOperation === 'fetch' ? 'Fetching...' : 'Fetch'}</span>
        </button>
        <button
          class="menu-item"
          role="menuitem"
          disabled={gitBusy() || props.gitUnavailable || props.pullDisabled}
          title={pullTitle()}
          onClick={props.onPull}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 18 3 13l5-5" />
            <path d="M3 13h10a6 6 0 0 0 6-6V5" />
          </svg>
          <span>{props.gitOperation === 'pull' ? 'Pulling...' : 'Pull'}</span>
        </button>
        <div class="menu-separator" role="separator" />
        <button class="menu-item" role="menuitem" onClick={props.onEdit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit Project Info</span>
        </button>
        <button class="menu-item" role="menuitem" onClick={props.onCloseProject}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>Close Project</span>
        </button>
      </div>
    </Show>
  );
};

export default ProjectMenu;
