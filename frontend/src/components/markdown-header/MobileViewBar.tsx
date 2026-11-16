import { Component, For, JSX, Show } from 'solid-js';
import styles from './styles.module.css';
import type { FileType } from '../../types';
import { visibleViewTabs, type TabType } from './ViewTabs';

export interface MobileViewBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  fileType?: FileType;
  isDirty?: boolean;
  binary?: boolean;
}

const tabTitles: Record<TabType, string> = {
  preview: 'Preview',
  source: 'Source',
  edit: 'Edit',
  diff: 'Diff',
};

const tabIcons: Record<TabType, JSX.Element> = {
  preview: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  source: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  edit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  diff: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" />
    </svg>
  ),
};

/**
 * Bottom view switcher for the mobile shell. The header carries the filename;
 * switching views happens down here in the thumb zone. Hidden when a file has
 * a single view (image, source-only, binary) — a one-item control is noise.
 */
export const MobileViewBar: Component<MobileViewBarProps> = (props) => {
  const tabs = () => visibleViewTabs(props.fileType, props.binary);

  return (
    <Show when={tabs().length > 1}>
      <nav class={styles.mobileViewBar} aria-label="View">
        <For each={tabs()}>
          {(tab) => (
            <button
              type="button"
              class={styles.mobileViewBarItem}
              classList={{ [styles.mobileViewBarActive]: props.activeTab === tab.id }}
              onClick={() => props.onTabChange(tab.id)}
              title={tabTitles[tab.id]}
              aria-label={tabTitles[tab.id]}
              aria-pressed={props.activeTab === tab.id}
            >
              {tabIcons[tab.id]}
              <Show when={tab.id === 'edit' && props.isDirty}>
                <span class={styles.mobileViewBarDirty} aria-label="unsaved changes" />
              </Show>
            </button>
          )}
        </For>
      </nav>
    </Show>
  );
};
