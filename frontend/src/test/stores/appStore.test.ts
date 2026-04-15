import { describe, it, expect, beforeEach } from 'vitest';
import { appStore } from '../../stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    appStore.setActiveTab('preview');
    appStore.setGitPanelOpen(false);
    appStore.setOutlineOpen(false);
    appStore.setSettingsOpen(false);
    appStore.setIsMobile(false);
    appStore.setSidebarWidth(280);
    appStore.setIsDragging(false);
    appStore.setOpenProjectDialogOpen(false);
    appStore.setColorPickerOpen(false);
    appStore.setColorPickerProjectId(null);
    appStore.setColorPickerPosition({ x: 0, y: 0 });
    appStore.setProjectEditDialogOpen(false);
    appStore.setTrashDialogOpen(false);
  });

  describe('tab state', () => {
    it('has default activeTab as preview', () => {
      expect(appStore.activeTab()).toBe('preview');
    });

    it('can change activeTab', () => {
      appStore.setActiveTab('edit');
      expect(appStore.activeTab()).toBe('edit');
    });

    it('can set different tabs', () => {
      const tabs = ['preview', 'source', 'edit', 'diff'] as const;
      tabs.forEach(tab => {
        appStore.setActiveTab(tab);
        expect(appStore.activeTab()).toBe(tab);
      });
    });
  });

  describe('panel states', () => {
    it('can toggle git panel', () => {
      expect(appStore.gitPanelOpen()).toBe(false);
      appStore.toggleGitPanel();
      expect(appStore.gitPanelOpen()).toBe(true);
      appStore.toggleGitPanel();
      expect(appStore.gitPanelOpen()).toBe(false);
    });

    it('can toggle outline', () => {
      expect(appStore.outlineOpen()).toBe(false);
      appStore.toggleOutline();
      expect(appStore.outlineOpen()).toBe(true);
    });

    it('can toggle settings', () => {
      expect(appStore.settingsOpen()).toBe(false);
      appStore.toggleSettings();
      expect(appStore.settingsOpen()).toBe(true);
    });

    it('can set git panel directly', () => {
      appStore.setGitPanelOpen(true);
      expect(appStore.gitPanelOpen()).toBe(true);
    });
  });

  describe('mobile state', () => {
    it('can set mobile state', () => {
      appStore.setIsMobile(true);
      expect(appStore.isMobile()).toBe(true);
    });

    it('has default mobile state as false', () => {
      expect(appStore.isMobile()).toBe(false);
    });
  });

  describe('sidebar state', () => {
    it('has default sidebar width', () => {
      expect(appStore.sidebarWidth()).toBe(280);
    });

    it('can change sidebar width', () => {
      appStore.setSidebarWidth(300);
      expect(appStore.sidebarWidth()).toBe(300);
    });

    it('can set dragging state', () => {
      appStore.setIsDragging(true);
      expect(appStore.isDragging()).toBe(true);
    });
  });

  describe('dialog states', () => {
    it('can open and close project dialog', () => {
      appStore.openOpenProjectDialog();
      expect(appStore.openProjectDialogOpen()).toBe(true);
      appStore.closeOpenProjectDialog();
      expect(appStore.openProjectDialogOpen()).toBe(false);
    });

    it('can open color picker', () => {
      appStore.openColorPicker(1, 100, 200);
      expect(appStore.colorPickerOpen()).toBe(true);
      expect(appStore.colorPickerProjectId()).toBe(1);
      expect(appStore.colorPickerPosition()).toEqual({ x: 100, y: 200 });
    });

    it('can close color picker', () => {
      appStore.openColorPicker(1, 100, 200);
      appStore.closeColorPicker();
      expect(appStore.colorPickerOpen()).toBe(false);
      expect(appStore.colorPickerProjectId()).toBe(null);
    });

    it('can open project edit dialog', () => {
      appStore.openProjectEditDialog();
      expect(appStore.projectEditDialogOpen()).toBe(true);
    });

    it('can open trash dialog', () => {
      appStore.openTrashDialog();
      expect(appStore.trashDialogOpen()).toBe(true);
    });
  });
});