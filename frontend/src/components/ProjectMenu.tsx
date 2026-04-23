import { Component, Show } from 'solid-js';

interface ProjectMenuProps {
  isOpen: boolean;
  position: { top: number; right: number };
  onRefresh: () => void;
  onEdit: () => void;
  onCloseProject: () => void;
  onCloseMenu: () => void;
}

const ProjectMenu: Component<ProjectMenuProps> = (props) => {
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
        style={{
          position: 'absolute',
          top: `${props.position.top}px`,
          right: `${props.position.right}px`,
          'z-index': 9999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button class="menu-item" onClick={props.onRefresh}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Refresh</span>
        </button>
        <button class="menu-item" onClick={props.onEdit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit Project Info</span>
        </button>
        <button class="menu-item" onClick={props.onCloseProject}>
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
