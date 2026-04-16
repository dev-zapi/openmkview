import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayout } from '../../hooks/useLayout';
import { appStore } from '../../stores/appStore';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';

describe('useLayout', () => {
  beforeEach(() => {
    appStore.setIsDragging(false);
    appStore.setSidebarWidth(280);
    appStore.setIsMobile(false);
    appStore.setOutlineOpen(false);
    mobileLayoutStore.closeAllDrawers();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
  });

  afterEach(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
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
});
