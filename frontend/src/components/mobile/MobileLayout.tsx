import { Component, JSX, Show } from 'solid-js';
import { MobileDrawer } from './MobileDrawer';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';
import styles from './MobileLayout.module.css';

type ThemeMode = 'light' | 'dark' | 'system';

interface MobileLayoutProps {
  children: JSX.Element;
  activityBarContent?: JSX.Element;
  sidebarContent?: JSX.Element;
  outlinePanelContent?: JSX.Element;
  headerContent?: JSX.Element;
  activeProjectName?: string;
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
  onThemeToggle?: () => void;
  currentTheme?: ThemeMode;
}

export const MobileLayout: Component<MobileLayoutProps> = (props) => {
  return (
    <div class={styles.mobileContainer}>
      {/* Mobile top bar */}
      <div class={styles.mobileTopBar}>
        <button
          class={styles.menuButton}
          onClick={() => mobileLayoutStore.toggleLeftDrawer()}
          title="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div class={styles.topBarTitle}>
          <span class={styles.topBarProjectName}>
            {props.activeProjectName || 'OpenMKView'}
          </span>
        </div>
        <div class={styles.topBarActions}>
          <button
            class={styles.topBarButton}
            onClick={props.onThemeToggle}
            title="Toggle theme"
          >
            <Show when={props.currentTheme === 'light'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </Show>
            <Show when={props.currentTheme === 'dark'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </Show>
            <Show when={props.currentTheme === 'system'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </Show>
          </button>
          <button
            class={styles.topBarButton}
            onClick={props.onSettingsClick}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div class={styles.mobileMain}>
        <Show when={props.headerContent}>
          {props.headerContent}
        </Show>
        <div class={styles.mobileContent}>
          {props.children}
        </div>
      </div>

      {/* Left drawer - ActivityBar + FileTree */}
      <MobileDrawer
        isOpen={mobileLayoutStore.leftDrawerOpen}
        onClose={mobileLayoutStore.closeLeftDrawer}
        position="left"
        width="85%"
      >
        <div class={styles.leftDrawerContent}>
          {/* ActivityBar section */}
          <Show when={props.activityBarContent}>
            <div class={styles.activityBarSection}>
              {props.activityBarContent}
            </div>
          </Show>
          
          {/* FileTree section */}
          <Show when={props.sidebarContent}>
            <div class={styles.sidebarSection}>
              <div class={styles.sidebarHeader}>Explorer</div>
              <div class={styles.sidebarContent}>
                {props.sidebarContent}
              </div>
            </div>
          </Show>
        </div>
      </MobileDrawer>

      {/* Right drawer - OutlinePanel */}
      <MobileDrawer
        isOpen={mobileLayoutStore.rightDrawerOpen}
        onClose={mobileLayoutStore.closeRightDrawer}
        position="right"
        width="80%"
        disableOverlayClose={true}
      >
        <div class={styles.rightDrawerContent}>
          <Show when={props.outlinePanelContent}>
            {props.outlinePanelContent}
          </Show>
        </div>
      </MobileDrawer>
    </div>
  );
};
