import { Component, createSignal, Show } from 'solid-js';
import type { Project } from '../types';
import type { RemoteGitAction } from '../utils/gitPanel';
import ProjectMenu from './ProjectMenu';
import { Menu, MenuTrigger } from './ui/Menu';
import { getProjectDisplayName, getProjectFaviconUrl, isFaviconIcon, getFaviconPath } from '../utils/projectIcon';

interface SidebarHeaderProps {
  project: Project;
  gitOperation?: RemoteGitAction;
  gitUnavailable: boolean;
  pullDisabled: boolean;
  onRefresh: () => void;
  onGitAction: (action: RemoteGitAction) => Promise<boolean>;
  onEdit: () => void;
  onCloseProject: () => void;
  onCollapse: () => void;
}

const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  const [menuOpen, setMenuOpen] = createSignal(false);

  const handleRefresh = () => {
    setMenuOpen(false);
    props.onRefresh();
  };

  const handleGitAction = async (action: RemoteGitAction) => {
    const projectId = props.project.id;
    const succeeded = await props.onGitAction(action);
    if (succeeded && props.project.id === projectId) setMenuOpen(false);
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
          src={getProjectFaviconUrl(faviconPath, props.project.id)}
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
        <button
          class="sidebar-header-collapse"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          aria-controls="file-tree-sidebar"
          onClick={props.onCollapse}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <path d="m16 9-3 3 3 3" />
          </svg>
        </button>
        <Menu open={menuOpen()} onOpenChange={setMenuOpen}>
          <MenuTrigger class="sidebar-header-menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </MenuTrigger>
          <ProjectMenu
            gitOperation={props.gitOperation}
            gitUnavailable={props.gitUnavailable}
            pullDisabled={props.pullDisabled}
            onRefresh={handleRefresh}
            onFetch={() => void handleGitAction('fetch')}
            onPull={() => void handleGitAction('pull')}
            onEdit={handleEdit}
            onCloseProject={handleCloseProject}
          />
        </Menu>
      </div>
    </div>
  );
};

export default SidebarHeader;
