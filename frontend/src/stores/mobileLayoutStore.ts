import { createSignal } from 'solid-js';

// Mobile drawer state management
const [leftDrawerOpen, setLeftDrawerOpen] = createSignal(false);
const [rightDrawerOpen, setRightDrawerOpen] = createSignal(false);

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

  // Right drawer (OutlinePanel)
  get rightDrawerOpen() {
    return rightDrawerOpen();
  },
  openRightDrawer: () => {
    setRightDrawerOpen(true);
    // Close left drawer when opening right
    setLeftDrawerOpen(false);
  },
  closeRightDrawer: () => setRightDrawerOpen(false),
  toggleRightDrawer: () => {
    setRightDrawerOpen(prev => {
      const newState = !prev;
      // Close left drawer when opening right
      if (newState) {
        setLeftDrawerOpen(false);
      }
      return newState;
    });
  },

  // Close all drawers
  closeAllDrawers: () => {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
  },
};
