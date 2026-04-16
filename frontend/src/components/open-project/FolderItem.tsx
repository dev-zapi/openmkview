import { Component, Show } from 'solid-js';
import type { ListableItem } from './utils/listItems';

export interface FolderItemProps {
  item: ListableItem;
  index: number;
  selectedIndex: number;
  showRecentTitle: boolean;
  showQuickAccessTitle: boolean;
  showSearchTitle: boolean;
  onClick: (path: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

const FolderItem: Component<FolderItemProps> = (props) => {
  return (
    <>
      <Show when={props.showRecentTitle}>
        <div class="section">
          <h3 class="section-title">Recent projects</h3>
        </div>
      </Show>
      <Show when={props.showQuickAccessTitle}>
        <div class="section">
          <h3 class="section-title">Open project</h3>
        </div>
      </Show>
      <Show when={props.showSearchTitle}>
        <div class="section">
          <h3 class="section-title">Search results</h3>
        </div>
      </Show>
      <div 
        class={`folder-item ${props.selectedIndex === props.index ? 'selected' : ''}`}
        onClick={() => props.onClick(props.item.path)}
        onKeyDown={props.onKeyDown}
        tabIndex={0}
        role="button"
      >
        <span class="folder-icon">{props.item.icon}</span>
        <Show when={props.item.relativePath} fallback={<span class="folder-path">{props.item.path}</span>}>
          <div class="folder-info">
            <span class="folder-name">{props.item.name}</span>
            <span class="folder-path-small">{props.item.relativePath}</span>
          </div>
        </Show>
      </div>
    </>
  );
};

export default FolderItem;
