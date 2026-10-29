import { Component, Show } from 'solid-js';
import styles from './styles.module.css';
import type { FileType } from '../../types';

export type TabType = 'preview' | 'source' | 'edit' | 'diff';

export interface ViewTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  fileType?: FileType;
  isDirty?: boolean;
  /** Binary files show a placeholder page with no tabs at all. */
  binary?: boolean;
}

export const ViewTabs: Component<ViewTabsProps> = (props) => {
  const tabs = [
    { id: 'preview' as const, label: 'Preview' },
    { id: 'source' as const, label: 'Source' },
    { id: 'edit' as const, label: 'Edit' },
    { id: 'diff' as const, label: 'Diff' },
  ];

  const visibleTabs = () => {
    if (props.binary) {
      return [];
    }
    if (props.fileType === 'image') {
      return tabs.filter(t => t.id === 'preview');
    }
    // Files without a dedicated renderer only have the read-only Source tab.
    if (props.fileType === 'other') {
      return tabs.filter(t => t.id === 'source');
    }
    return tabs;
  };

  return (
    <div class={styles.viewTabs}>
      {visibleTabs().map((tab) => (
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
