import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayout } from '../../hooks/useLayout';
import { appStore } from '../../stores/appStore';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';
import { fileStore } from '../../stores/fileStore';

describe('useLayout', () => {
  beforeEach(() => {
    appStore.setIsDragging(false);
    appStore.setIsOutlineDragging(false);
    appStore.setIsAnnotationColumnDragging(false);
    appStore.setSidebarWidth(280);
    appStore.setIsMobile(false);
    appStore.setOutlineOpen(false);
    mobileLayoutStore.closeAllDrawers();
    
    // Set a mock file for outline toggle tests
    fileStore.setCurrentFile({
      fileName: 'test.md',
      content: '# Test',
      path: 'test.md'
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
  });

  afterEach(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    fileStore.setCurrentFile(null);
    vi.restoreAllMocks();
  });

  it('starts dragging and updates body styles', () => {
    const { startDragging } = useLayout();

    startDragging();

    expect(appStore.isDragging()).toBe(true);
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
  });

  it('toggles outline on desktop', () => {
    const { handleMobileOutlineToggle } = useLayout();

    handleMobileOutlineToggle();

    expect(appStore.outlineOpen()).toBe(true);
    expect(mobileLayoutStore.rightDrawerOpen).toBe(false);
  });

  it('toggles right drawer on mobile', () => {
    const { handleMobileOutlineToggle } = useLayout();
    appStore.setIsMobile(true);

    handleMobileOutlineToggle();

    expect(mobileLayoutStore.rightDrawerOpen).toBe(true);
    expect(appStore.outlineOpen()).toBe(false);
  });

  it('returns no transition while dragging', () => {
    const { getSidebarTransitionStyle } = useLayout();
    appStore.setIsDragging(true);

    expect(getSidebarTransitionStyle()).toBe('none');
  });

  it('returns animated transition when idle', () => {
    const { getSidebarTransitionStyle } = useLayout();

    expect(getSidebarTransitionStyle()).toBe('width 0.2s cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('updates sidebar width during drag and cleans up on mouseup', () => {
    const { setupResizeHandlers } = useLayout();
    const cleanup = setupResizeHandlers();
    appStore.setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
    expect(appStore.sidebarWidth()).toBe(448);
    expect(localStorage.getItem('filetree-sidebar-width')).toBe('448');

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(appStore.isDragging()).toBe(false);
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');

    cleanup();
  });

  it('uses framed layout bounds for sidebar drag offsets', () => {
    const activityBar = document.createElement('div');
    activityBar.className = 'activity-bar';
    vi.spyOn(activityBar, 'getBoundingClientRect').mockReturnValue({ right: 59 } as DOMRect);

    const appContainer = document.createElement('div');
    appContainer.className = 'app-container';
    appContainer.style.borderRightWidth = '1px';
    vi.spyOn(appContainer, 'getBoundingClientRect').mockReturnValue({ right: 1193 } as DOMRect);
    document.body.append(activityBar, appContainer);

    const { setupResizeHandlers } = useLayout();
    const cleanup = setupResizeHandlers();

    appStore.setIsDragging(true);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
    expect(appStore.sidebarWidth()).toBe(441);
    appStore.setIsDragging(false);
    cleanup();
    activityBar.remove();
    appContainer.remove();
  });

  it('uses relative pointer movement when resizing the outline in a framed layout', () => {
    const outline = document.createElement('div');
    outline.className = 'outline-panel';
    vi.spyOn(outline, 'getBoundingClientRect').mockReturnValue({ width: 280 } as DOMRect);
    const handle = document.createElement('div');
    outline.append(handle);
    document.body.append(outline);

    const { setupResizeHandlers, startOutlineDragging } = useLayout();
    const cleanup = setupResizeHandlers();
    const startEvent = new MouseEvent('mousedown', { clientX: 901 });
    Object.defineProperty(startEvent, 'currentTarget', { value: handle });
    startOutlineDragging(startEvent);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 }));
    expect(appStore.outlineWidth()).toBe(281);

    cleanup();
    outline.remove();
  });

  it('keeps the outline divider under the pointer beside an annotation column', () => {
    const outline = document.createElement('div');
    outline.className = 'outline-panel';
    vi.spyOn(outline, 'getBoundingClientRect').mockReturnValue({ width: 280 } as DOMRect);
    const handle = document.createElement('div');
    outline.append(handle);
    document.body.append(outline);

    const { setupResizeHandlers, startOutlineDragging } = useLayout();
    const cleanup = setupResizeHandlers();
    const startEvent = new MouseEvent('mousedown', { clientX: 900 });
    Object.defineProperty(startEvent, 'currentTarget', { value: handle });
    startOutlineDragging(startEvent);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 880 }));
    expect(appStore.outlineWidth()).toBe(300);

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }));
    // Starting width (280) + pointer delta (900 - 600) = 580, capped at 40%.
    expect(appStore.outlineWidth()).toBe(480);
    expect(localStorage.getItem('outline-panel-width')).not.toBe('480');
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(localStorage.getItem('outline-panel-width')).toBe('480');
    cleanup();
    outline.remove();
  });

  it('resizes the annotation column, clamps its width, and saves on mouseup', () => {
    const column = document.createElement('div');
    column.className = 'annotation-column';
    vi.spyOn(column, 'getBoundingClientRect').mockReturnValue({ width: 300 } as DOMRect);
    const handle = document.createElement('div');
    column.append(handle);
    document.body.append(column);

    const { setupResizeHandlers, startAnnotationColumnDragging, getAnnotationColumnTransitionStyle } = useLayout();
    const cleanup = setupResizeHandlers();
    const startEvent = new MouseEvent('mousedown', { clientX: 900 });
    Object.defineProperty(startEvent, 'currentTarget', { value: handle });
    startAnnotationColumnDragging(startEvent);
    expect(getAnnotationColumnTransitionStyle()).toBe('none');

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 860 }));
    expect(appStore.annotationColumnWidth()).toBe(340);
    expect(localStorage.getItem('annotation-column-width')).not.toBe('340');

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }));
    expect(appStore.annotationColumnWidth()).toBe(200);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
    expect(appStore.annotationColumnWidth()).toBe(480);
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(appStore.isAnnotationColumnDragging()).toBe(false);
    expect(localStorage.getItem('annotation-column-width')).toBe('480');
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    expect(getAnnotationColumnTransitionStyle()).toBe('width 0.2s cubic-bezier(0.4, 0, 0.2, 1)');
    cleanup();
    column.remove();
  });

  it('clamps sidebar width on resize', () => {
    const { setupResizeHandlers } = useLayout();
    const cleanup = setupResizeHandlers();
    appStore.setSidebarWidth(600);
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    window.dispatchEvent(new Event('resize'));

    expect(appStore.sidebarWidth()).toBe(320);
    expect(localStorage.getItem('filetree-sidebar-width')).toBe('320');

    cleanup();
  });

  it('clamps annotation column width on resize', () => {
    const { setupResizeHandlers } = useLayout();
    const cleanup = setupResizeHandlers();
    appStore.setAnnotationColumnWidth(500);
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    window.dispatchEvent(new Event('resize'));

    expect(appStore.annotationColumnWidth()).toBe(320);
    expect(localStorage.getItem('annotation-column-width')).toBe('320');
    cleanup();
  });
});
