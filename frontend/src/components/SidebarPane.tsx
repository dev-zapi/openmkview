import { Component, Show } from 'solid-js';
import type { Project, FileNode } from '../types';
import FileTree from './FileTree';
import SidebarHeader from './SidebarHeader';

interface SidebarPaneProps {
  project: Project | null;
  nodes: FileNode[];
  sidebarWidth: number;
  transition: string;
  onRefresh: () => void;
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
          onRefresh={props.onRefresh}
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
          />
        </div>
        <div class="sidebar-resize-handle" onMouseDown={props.onStartDragging} />
      </aside>
    </Show>
  );
};

export default SidebarPane;
