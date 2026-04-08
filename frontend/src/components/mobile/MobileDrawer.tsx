import { Component, JSX, Show, createEffect, createSignal, onCleanup } from 'solid-js';
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
  let overlayRef: HTMLDivElement | undefined;

  // Touch/swipe tracking
  const [touchStartX, setTouchStartX] = createSignal(0);
  const [touchCurrentX, setTouchCurrentX] = createSignal(0);
  const [isSwiping, setIsSwiping] = createSignal(false);

  const SWIPE_THRESHOLD = 80;

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

  // Touch handlers for swipe-to-close
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchCurrentX(touch.clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping()) return;
    const touch = e.touches[0];
    setTouchCurrentX(touch.clientX);

    const delta = touch.clientX - touchStartX();

    // Only allow swiping in the closing direction
    if (props.position === 'left' && delta < 0) {
      // Swiping left to close left drawer
      if (drawerRef) {
        drawerRef.style.transform = `translateX(${delta}px)`;
        drawerRef.style.transition = 'none';
      }
      if (overlayRef) {
        const progress = Math.max(0, 1 + delta / (drawerRef?.offsetWidth || 300));
        overlayRef.style.background = `rgba(0, 0, 0, ${0.5 * progress})`;
      }
    } else if (props.position === 'right' && delta > 0) {
      // Swiping right to close right drawer
      if (drawerRef) {
        drawerRef.style.transform = `translateX(${delta}px)`;
        drawerRef.style.transition = 'none';
      }
      if (overlayRef) {
        const progress = Math.max(0, 1 - delta / (drawerRef?.offsetWidth || 300));
        overlayRef.style.background = `rgba(0, 0, 0, ${0.5 * progress})`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping()) return;
    setIsSwiping(false);

    const delta = touchCurrentX() - touchStartX();
    const shouldClose =
      (props.position === 'left' && delta < -SWIPE_THRESHOLD) ||
      (props.position === 'right' && delta > SWIPE_THRESHOLD);

    if (drawerRef) {
      drawerRef.style.transition = '';
      drawerRef.style.transform = '';
    }
    if (overlayRef) {
      overlayRef.style.background = '';
    }

    if (shouldClose) {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        ref={overlayRef}
        class={styles.drawerOverlay}
        onClick={handleOverlayClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
