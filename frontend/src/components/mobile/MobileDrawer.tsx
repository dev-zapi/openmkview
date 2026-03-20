import { Component, JSX, Show, createEffect, onCleanup } from 'solid-js';
import styles from './MobileDrawer.module.css';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'left' | 'right';
  children: JSX.Element;
  width?: string;
  disableOverlayClose?: boolean;
}

export const MobileDrawer: Component<MobileDrawerProps> = (props) => {
  let drawerRef: HTMLDivElement | undefined;

  // Handle ESC key to close drawer
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen) {
      props.onClose();
    }
  };

  // Prevent body scroll when drawer is open
  createEffect(() => {
    if (props.isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    onCleanup(() => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  // Handle click outside drawer content
  const handleOverlayClick = (e: MouseEvent) => {
    if (props.disableOverlayClose) {
      return;
    }
    if (drawerRef && !drawerRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class={styles.drawerOverlay} onClick={handleOverlayClick}>
        <div
          ref={drawerRef}
          class={`${styles.drawer} ${styles[props.position]}`}
          style={props.width ? { width: props.width } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div class={styles.drawerContent}>
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  );
};
