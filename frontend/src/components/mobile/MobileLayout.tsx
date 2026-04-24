import { Component, JSX, Show } from 'solid-js';
import { MobileDrawer } from './MobileDrawer';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';
import styles from './MobileLayout.module.css';

interface MobileLayoutProps {
  children: JSX.Element;
  activityBarContent?: JSX.Element;
  sidebarContent?: JSX.Element;
  outlinePanelContent?: JSX.Element;
  headerContent?: JSX.Element;
  activeProjectName?: string;
  leftDrawerCloseOnEscape?: boolean;
  leftDrawerModal?: boolean;
  onProjectMenuOpen?: (e: MouseEvent) => void;
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
          aria-label="Toggle navigation menu"
          aria-expanded={mobileLayoutStore.leftDrawerOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div class={styles.topBarTitle}>
          <span class={styles.topBarProjectName} data-testid="mobile-topbar-title">
            {props.activeProjectName || 'OpenMKView'}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div class={styles.mobileMain}>
        <Show when={props.headerContent}>
          {(content) => content()}
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
        closeOnEscape={props.leftDrawerCloseOnEscape}
        modal={props.leftDrawerModal}
      >
        <div class={styles.leftDrawerContent}>
          <Show when={props.activityBarContent}>
            {(content) => (
              <div class={styles.activityBarSection}>
                {content()}
              </div>
            )}
          </Show>

          <Show when={props.sidebarContent}>
            {(content) => (
              <div class={styles.sidebarSection}>
                <div class={styles.sidebarHeader}>
                  <span class={styles.sidebarHeaderTitle} data-testid="mobile-sidebar-title">
                    {props.activeProjectName || 'Explorer'}
                  </span>
                  <Show when={props.activeProjectName && props.onProjectMenuOpen}>
                    <button
                      class={styles.sidebarHeaderMenuButton}
                      onClick={(e) => props.onProjectMenuOpen!(e)}
                      title="Project options"
                      aria-label="Project options"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                  </Show>
                </div>
                <div class={styles.sidebarContent}>
                  {content()}
                </div>
              </div>
            )}
          </Show>
        </div>
      </MobileDrawer>

      {/* Right drawer - OutlinePanel */}
      <MobileDrawer
        isOpen={mobileLayoutStore.rightDrawerOpen}
        onClose={mobileLayoutStore.closeRightDrawer}
        position="right"
        width="80%"
      >
        <div class={styles.rightDrawerContent}>
          <Show when={props.outlinePanelContent}>
            {(content) => content()}
          </Show>
        </div>
      </MobileDrawer>
    </div>
  );
};
