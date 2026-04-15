import { onMount, onCleanup } from 'solid-js';
import { appStore } from '../stores/appStore';
import { settingsStore } from '../stores/settingsStore';
import { saveSidebarWidth, getValidatedSidebarWidth } from '../utils/settings';
import { mobileLayoutStore } from '../stores/mobileLayoutStore';

export const useLayout = () => {
  const setupResizeHandlers = () => {
    const handleMouseMove = (e: MouseEvent) => {
      if (appStore.isDragging()) {
        const newWidth = getValidatedSidebarWidth(e.clientX - 52);
        appStore.setSidebarWidth(newWidth);
        saveSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (appStore.isDragging()) {
        appStore.setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    const handleResize = () => {
      appStore.checkMobile();
      
      const maxWidth = window.innerWidth * 0.4;
      const currentWidth = appStore.sidebarWidth();
      if (currentWidth > maxWidth) {
        appStore.setSidebarWidth(maxWidth);
        saveSidebarWidth(maxWidth);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  };

  const startDragging = () => {
    appStore.setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMobileOutlineToggle = () => {
    if (appStore.isMobile()) {
      mobileLayoutStore.toggleRightDrawer();
    } else {
      appStore.toggleOutline();
    }
  };

  const getSidebarTransitionStyle = () => {
    return appStore.isDragging() ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  };

  return {
    setupResizeHandlers,
    startDragging,
    handleMobileOutlineToggle,
    getSidebarTransitionStyle,
  };
};

export default useLayout;