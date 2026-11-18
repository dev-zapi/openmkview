import { Component, JSX, Show } from 'solid-js';
import { MobileDrawer } from './MobileDrawer';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';
import styles from './MobileLayout.module.css';

interface MobileLayoutProps {
  children: JSX.Element;
  activityBarContent?: JSX.Element;
  sidebarContent?: JSX.Element;
  outlinePanelContent?: JSX.Element;
  /** Content of the same right drawer when its mode is the annotation column. */
  annotationPanelContent?: JSX.Element;
  headerContent?: JSX.Element;
  /** Docked below the scroll area: the mobile bottom view bar. */
  bottomBarContent?: JSX.Element;
  activeProjectName?: string;
  leftDrawerCloseOnEscape?: boolean;
  leftDrawerModal?: boolean;
  onProjectMenuOpen?: (e: MouseEvent) => void;
  /**
   * When true, the standalone top bar (hamburger + project name) is hidden
   * because the header content already includes a merged hamburger button.
   */
  hideTopBar?: boolean;
}

export const MobileLayout: Component<MobileLayoutProps> = (props) => {
  return (
    <div class={styles.mobileContainer} classList={{ [styles.hasBottomBar]: Boolean(props.bottomBarContent) }}>
      {/* Mobile top bar (hidden when the merged header content is being shown) */}
      <Show when={!props.hideTopBar}>
        <div class={`${styles.mobileTopBar} topbar-glass`}>
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
      </Show>

      {/* Main content area */}
      <div class={styles.mobileMain}>
        <Show when={props.headerContent}>
          {(content) => content()}
        </Show>
        <div class={styles.mobileContent}>
          {props.children}
        </div>
        <Show when={props.bottomBarContent}>
          {(content) => content()}
        </Show>
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
                      {/* Sliders, not an ellipsis: the header's ⋯ owns document actions,
                          this one owns project actions — same glyph would read as one menu. */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="4" y1="21" x2="4" y2="14" />
                        <line x1="4" y1="10" x2="4" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12" y2="3" />
                        <line x1="20" y1="21" x2="20" y2="16" />
                        <line x1="20" y1="12" x2="20" y2="3" />
                        <line x1="1" y1="14" x2="7" y2="14" />
                        <line x1="9" y1="8" x2="15" y2="8" />
                        <line x1="17" y1="16" x2="23" y2="16" />
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

      {/* Right drawer - outline or annotation column */}
      <MobileDrawer
        isOpen={mobileLayoutStore.rightDrawerOpen}
        onClose={mobileLayoutStore.closeRightDrawer}
        position="right"
        width="80%"
        ariaLabel={mobileLayoutStore.rightDrawerMode === 'annotations' ? 'Annotations' : undefined}
      >
        <div class={styles.rightDrawerContent}>
          <Show when={mobileLayoutStore.rightDrawerMode === 'annotations'} fallback={
            <Show when={props.outlinePanelContent}>
              {(content) => content()}
            </Show>
          }>
            <Show when={props.annotationPanelContent}>
              {(content) => content()}
            </Show>
          </Show>
        </div>
      </MobileDrawer>
    </div>
  );
};
