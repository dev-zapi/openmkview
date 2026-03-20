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
}

export const MobileLayout: Component<MobileLayoutProps> = (props) => {
  return (
    <div class={styles.mobileContainer}>
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
        width="90%"
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
        width="85%"
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
