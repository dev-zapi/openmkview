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
