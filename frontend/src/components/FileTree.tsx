import { Component, For, createSignal, Show } from 'solid-js';
import type { FileNode } from '../types';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string, name: string) => void;
}

interface TreeNodeProps {
  node: FileNode;
  onFileClick: (path: string, name: string) => void;
}

const TreeNode: Component<TreeNodeProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const handleClick = () => {
    if (props.node.isFolder) {
      setExpanded(!expanded());
    } else {
      props.onFileClick(props.node.path, props.node.name);
    }
  };

  return (
    <li>
      <div
        class={`tree-item ${props.node.isFolder ? 'folder' : 'file'}`}
        onClick={handleClick}
      >
        <span class="icon">
          {props.node.isFolder ? (expanded() ? '📂' : '📁') : '📄'}
        </span>
        <span class="name">{props.node.name}</span>
      </div>
      <Show when={props.node.isFolder && expanded() && props.node.children}>
        <ul class="folder-children">
          <For each={props.node.children}>
            {(child) => (
              <TreeNode node={child} onFileClick={props.onFileClick} />
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
            <TreeNode node={node} onFileClick={props.onFileClick} />
          )}
        </For>
      </ul>
    </div>
  );
};

export default FileTree;
