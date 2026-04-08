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
  const [touchStartY, setTouchStartY] = createSignal(0);
  const [touchCurrentX, setTouchCurrentX] = createSignal(0);
  const [isSwiping, setIsSwiping] = createSignal(false);
  const [isSwipeConfirmed, setIsSwipeConfirmed] = createSignal(false);

  const SWIPE_THRESHOLD = 80;
  const DEAD_ZONE = 10;

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
      document.removeEventListener('keydown', handleKeyDown);
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
    setTouchStartY(touch.clientY);
    setTouchCurrentX(touch.clientX);
    setIsSwiping(true);
    setIsSwipeConfirmed(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping()) return;
    const touch = e.touches[0];
    setTouchCurrentX(touch.clientX);

    // Determine dominant axis in dead zone
    if (!isSwipeConfirmed()) {
      const dx = Math.abs(touch.clientX - touchStartX());
      const dy = Math.abs(touch.clientY - touchStartY());
      if (dx < DEAD_ZONE && dy < DEAD_ZONE) return;
      if (dy > dx) {
        // Vertical scroll - abort swipe tracking
        setIsSwiping(false);
        return;
      }
      setIsSwipeConfirmed(true);
    }

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
    setIsSwipeConfirmed(false);

    const delta = touchCurrentX() - touchStartX();
    const shouldClose =
      (props.position === 'left' && delta < -SWIPE_THRESHOLD) ||
      (props.position === 'right' && delta > SWIPE_THRESHOLD);

    if (shouldClose) {
      // Animate out before closing
      if (drawerRef) {
        drawerRef.style.transition = 'transform 0.2s ease';
        drawerRef.style.transform = props.position === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
      }
      if (overlayRef) {
        overlayRef.style.transition = 'background 0.2s ease';
        overlayRef.style.background = 'rgba(0, 0, 0, 0)';
      }
      setTimeout(() => props.onClose(), 200);
    } else {
      // Snap back to open position
      if (drawerRef) {
        drawerRef.style.transition = 'transform 0.2s ease';
        drawerRef.style.transform = '';
      }
      if (overlayRef) {
        overlayRef.style.transition = 'background 0.2s ease';
        overlayRef.style.background = '';
      }
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
        role="dialog"
        aria-modal="true"
        aria-label={props.position === 'left' ? 'Navigation drawer' : 'Outline panel'}
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
