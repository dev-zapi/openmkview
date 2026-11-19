import { appStore } from '../stores/appStore';
import { 
  saveSidebarWidth, 
  getValidatedSidebarWidth,
  saveOutlineWidth,
  getValidatedOutlineWidth 
} from '../utils/settings';
import { mobileLayoutStore } from '../stores/mobileLayoutStore';
import { fileStore } from '../stores/fileStore';
import { getFileTypeCategory } from '../utils/fileType';

export const useLayout = () => {
  const setupResizeHandlers = () => {
    const handleMouseMove = (e: MouseEvent) => {
      if (appStore.isDragging()) {
        const activityBar = document.querySelector<HTMLElement>('.activity-bar');
        const sidebarStart = activityBar?.getBoundingClientRect().right ?? 52;
        const newWidth = getValidatedSidebarWidth(e.clientX - sidebarStart);
        appStore.setSidebarWidth(newWidth);
        saveSidebarWidth(newWidth);
      }
      if (appStore.isOutlineDragging()) {
        const origin = appStore.outlineDragOrigin();
        const newWidth = getValidatedOutlineWidth(
          origin.width + origin.pointerX - e.clientX,
        );
        appStore.setOutlineWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (appStore.isDragging()) {
        appStore.setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (appStore.isOutlineDragging()) {
        appStore.setIsOutlineDragging(false);
        saveOutlineWidth(appStore.outlineWidth());
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
      
      // Validate outline width against new max
      const outlineMaxWidth = window.innerWidth * 0.4;
      const currentOutlineWidth = appStore.outlineWidth();
      if (currentOutlineWidth > outlineMaxWidth) {
        appStore.setOutlineWidth(outlineMaxWidth);
        saveOutlineWidth(outlineMaxWidth);
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

  const startOutlineDragging = (event: MouseEvent) => {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const outline = handle.closest<HTMLElement>('.outline-panel');
    const width = outline?.getBoundingClientRect().width ?? appStore.outlineWidth();
    appStore.setOutlineDragOrigin({ pointerX: event.clientX, width });
    // Set width and disable its transition together before the first move.
    appStore.setOutlineWidth(width);
    appStore.setIsOutlineDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMobileOutlineToggle = () => {
    if (appStore.isMobile()) {
      mobileLayoutStore.toggleRightDrawer();
    } else {
      const currentFile = fileStore.currentFile();
      if (!currentFile) return;
      
      const fileTypeCategory = getFileTypeCategory(currentFile.fileName);
      const newState = !appStore.outlineOpen();
      
      appStore.setOutlineOpen(newState);
      appStore.setOutlineOpenForFileType(fileTypeCategory, newState);
    }
  };

  const getSidebarTransitionStyle = () => {
    return appStore.isDragging() ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  };

  const getOutlineTransitionStyle = () => {
    return appStore.isOutlineDragging() ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  };

  return {
    setupResizeHandlers,
    startDragging,
    startOutlineDragging,
    handleMobileOutlineToggle,
    getSidebarTransitionStyle,
    getOutlineTransitionStyle,
  };
};

export default useLayout;