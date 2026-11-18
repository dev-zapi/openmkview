import { createSignal } from 'solid-js';

export type RightDrawerMode = 'outline' | 'annotations';

// Mobile drawer state management
const [leftDrawerOpen, setLeftDrawerOpen] = createSignal(false);
const [rightDrawerOpen, setRightDrawerOpen] = createSignal(false);
const [rightDrawerMode, setRightDrawerMode] = createSignal<RightDrawerMode>('outline');

export const mobileLayoutStore = {
  // Left drawer (ActivityBar + FileTree)
  get leftDrawerOpen() {
    return leftDrawerOpen();
  },
  openLeftDrawer: () => {
    setLeftDrawerOpen(true);
    // Close right drawer when opening left
    setRightDrawerOpen(false);
  },
  closeLeftDrawer: () => setLeftDrawerOpen(false),
  toggleLeftDrawer: () => {
    setLeftDrawerOpen(prev => {
      const newState = !prev;
      // Close right drawer when opening left
      if (newState) {
        setRightDrawerOpen(false);
      }
      return newState;
    });
  },

  // Right drawer (outline or the annotation column)
  get rightDrawerOpen() {
    return rightDrawerOpen();
  },
  get rightDrawerMode() {
    return rightDrawerMode();
  },
  openRightDrawer: (mode: RightDrawerMode = 'outline') => {
    setRightDrawerMode(mode);
    setRightDrawerOpen(true);
    // Close left drawer when opening right
    setLeftDrawerOpen(false);
  },
  closeRightDrawer: () => setRightDrawerOpen(false),
  toggleRightDrawer: (mode: RightDrawerMode = 'outline') => {
    if (rightDrawerOpen() && rightDrawerMode() === mode) {
      setRightDrawerOpen(false);
      return;
    }
    setRightDrawerMode(mode);
    setRightDrawerOpen(true);
    // Close left drawer when opening right
    setLeftDrawerOpen(false);
  },

  // Close all drawers
  closeAllDrawers: () => {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
  },
};
