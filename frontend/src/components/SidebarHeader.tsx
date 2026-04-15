import { Component, createSignal, Show } from 'solid-js';
import type { Project } from '../types';
import { api } from '../services/api';
import ProjectMenu from './ProjectMenu';

interface SidebarHeaderProps {
  project: Project;
  onRefresh: () => void;
  onEdit: () => void;
  onCloseProject: () => void;
}

const isFaviconIcon = (icon: string | null | undefined): boolean => {
  return icon?.startsWith('favicon:') ?? false;
};

const getFaviconPath = (icon: string): string => {
  return icon.replace('favicon:', '');
};

const getProjectDisplayName = (project: Project): string => {
  return project.icon ? project.icon : project.name.charAt(0).toUpperCase();
};

const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  const [menuOpen, setMenuOpen] = createSignal(false);

  const handleMenuToggle = (e: MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen());
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  const handleRefresh = () => {
    setMenuOpen(false);
    props.onRefresh();
  };

  const handleEdit = () => {
    setMenuOpen(false);
    props.onEdit();
  };

  const handleCloseProject = () => {
    setMenuOpen(false);
    props.onCloseProject();
  };

  const renderIcon = () => {
    if (isFaviconIcon(props.project.icon)) {
      const faviconPath = getFaviconPath(props.project.icon!);
      return (
        <img
          src={api.getFileRawUrl(faviconPath, props.project.id)}
          alt="favicon"
          class="sidebar-header-favicon"
        />
      );
    }
    return getProjectDisplayName(props.project);
  };

  return (
    <div class="sidebar-header">
      <div class="sidebar-header-content">
        <span
          class="sidebar-header-icon"
          style={props.project.color ? { background: props.project.color } : {}}
        >
          {renderIcon()}
        </span>
        <span class="sidebar-header-name">{props.project.name}</span>
        <button class="sidebar-header-menu" onClick={handleMenuToggle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        <ProjectMenu
          isOpen={menuOpen()}
          position={{ top: 40, right: 12 }}
          onRefresh={handleRefresh}
          onEdit={handleEdit}
          onCloseProject={handleCloseProject}
          onCloseMenu={handleCloseMenu}
        />
      </div>
    </div>
  );
};

export default SidebarHeader;