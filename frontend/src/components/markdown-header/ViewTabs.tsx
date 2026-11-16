import { Component, Show } from 'solid-js';
import styles from './styles.module.css';
import type { FileType } from '../../types';

export type TabType = 'preview' | 'source' | 'edit' | 'diff';

export interface ViewTab {
  id: TabType;
  label: string;
}

const ALL_TABS: ViewTab[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'source', label: 'Source' },
  { id: 'edit', label: 'Edit' },
  { id: 'diff', label: 'Diff' },
];

/**
 * Which views exist for a file type. Shared by the desktop text tabs and the
 * mobile bottom view bar so the two controls can never disagree.
 */
export const visibleViewTabs = (fileType?: FileType, binary?: boolean): ViewTab[] => {
  if (binary) {
    return [];
  }
  if (fileType === 'image') {
    return ALL_TABS.filter(t => t.id === 'preview');
  }
  // Files without a dedicated renderer only have the read-only Source tab.
  if (fileType === 'other') {
    return ALL_TABS.filter(t => t.id === 'source');
  }
  return ALL_TABS;
};

export interface ViewTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  fileType?: FileType;
  isDirty?: boolean;
  /** Binary files show a placeholder page with no tabs at all. */
  binary?: boolean;
}

export const ViewTabs: Component<ViewTabsProps> = (props) => {
  return (
    <div class={styles.viewTabs}>
      {visibleViewTabs(props.fileType, props.binary).map((tab) => (
        <button
          class={`${styles.tabItem} ${
            props.activeTab === tab.id ? styles.active : ''
          }`}
          onClick={() => props.onTabChange(tab.id)}
        >
          {tab.label}
          <Show when={tab.id === 'edit' && props.isDirty}>
            <span class={styles.dirtyIndicator}>*</span>
          </Show>
        </button>
      ))}
    </div>
  );
};
