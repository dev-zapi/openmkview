import { Component, Show } from 'solid-js';
import type { Project, FileNode } from '../types';
import type { RemoteGitAction } from '../utils/gitPanel';
import FileTree from './FileTree';
import SidebarHeader from './SidebarHeader';

interface SidebarPaneProps {
  project: Project | null;
  nodes: FileNode[];
  sidebarWidth: number;
  transition: string;
  gitOperation?: RemoteGitAction;
  gitUnavailable: boolean;
  pullDisabled: boolean;
  onRefresh: () => void;
  onGitAction: (action: RemoteGitAction) => Promise<boolean>;
  onEdit: () => void;
  onCloseProject: () => void;
  onFileClick: (path: string, relativePath: string) => void;
  onDelete: (node: FileNode) => void;
  onCopyPath: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
  onStartDragging: () => void;
}

export const SidebarPane: Component<SidebarPaneProps> = (props) => {
  return (
    <Show when={props.project}>
      <aside
        class="sidebar sidebar-enter"
        style={{ width: `${props.sidebarWidth}px`, transition: props.transition }}
      >
        <SidebarHeader
          project={props.project!}
          gitOperation={props.gitOperation}
          gitUnavailable={props.gitUnavailable}
          pullDisabled={props.pullDisabled}
          onRefresh={props.onRefresh}
          onGitAction={props.onGitAction}
          onEdit={props.onEdit}
          onCloseProject={props.onCloseProject}
        />
        <div class="sidebar-content">
          <FileTree
            nodes={props.nodes}
            onFileClick={props.onFileClick}
            onDelete={props.onDelete}
            onCopyPath={props.onCopyPath}
            onRename={props.onRename}
            projectId={props.project?.id}
          />
        </div>
        <div class="sidebar-resize-handle" onMouseDown={props.onStartDragging} />
      </aside>
    </Show>
  );
};

export default SidebarPane;
