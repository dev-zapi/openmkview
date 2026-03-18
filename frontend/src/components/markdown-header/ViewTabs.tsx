import { Component } from 'solid-js';
import styles from './styles.module.css';

export interface ViewTabsProps {
  activeTab: 'preview' | 'source' | 'diff';
  onTabChange: (tab: 'preview' | 'source' | 'diff') => void;
}

export const ViewTabs: Component<ViewTabsProps> = (props) => {
  const tabs = [
    { id: 'preview' as const, label: 'Preview' },
    { id: 'source' as const, label: 'Source' },
    { id: 'diff' as const, label: 'Diff' },
  ];

  return (
    <div class={styles.viewTabs}>
      {tabs.map((tab) => (
        <button
          class={`${styles.tabItem} ${
            props.activeTab === tab.id ? styles.active : ''
          }`}
          onClick={() => props.onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
