import { Component, For, Show, createEffect } from 'solid-js';
import type { FileNode } from '../types';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string, relativePath: string) => void;
  expandedFolders?: Set<string>;
  onFolderToggle?: (path: string, expanded: boolean) => void;
}

interface TreeNodeProps {
  node: FileNode;
  onFileClick: (path: string, relativePath: string) => void;
  expandedFolders?: Set<string>;
  onFolderToggle?: (path: string, expanded: boolean) => void;
}

const TreeNode: Component<TreeNodeProps> = (props) => {
  const isExpanded = () => props.expandedFolders?.has(props.node.path) || false;

  const handleClick = () => {
    if (props.node.isFolder) {
      const newExpanded = !isExpanded();
      props.onFolderToggle?.(props.node.path, newExpanded);
    } else {
      props.onFileClick(props.node.path, props.node.id);
    }
  };

  return (
    <li>
      <div
        class={`tree-item ${props.node.isFolder ? 'folder' : 'file'}`}
        onClick={handleClick}
      >
        <span class={`icon ${props.node.isFolder ? (isExpanded() ? 'folder-icon expanded' : 'folder-icon') : ''}`}>
          {props.node.isFolder ? (isExpanded() ? '📂' : '📁') : '📄'}
        </span>
        <span class="name">{props.node.name}</span>
      </div>
      <Show when={props.node.isFolder && isExpanded() && props.node.children}>
        <ul class="folder-children">
          <For each={props.node.children}>
            {(child) => (
              <TreeNode 
                node={child} 
                onFileClick={props.onFileClick}
                expandedFolders={props.expandedFolders}
                onFolderToggle={props.onFolderToggle}
              />
            )}
          </For>
        </ul>
      </Show>
    </li>
  );
};

const FileTree: Component<FileTreeProps> = (props) => {
  return (
    <div class="file-tree">
      <ul>
        <For each={props.nodes}>
          {(node) => (
            <TreeNode 
              node={node} 
              onFileClick={props.onFileClick}
              expandedFolders={props.expandedFolders}
              onFolderToggle={props.onFolderToggle}
            />
          )}
        </For>
      </ul>
    </div>
  );
};

export default FileTree;
