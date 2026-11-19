import { createSignal } from 'solid-js';
import type { TabType } from '../components/markdown-header/ViewTabs';
import { DEFAULT_OUTLINE_WIDTH, DEFAULT_ANNOTATION_COLUMN_WIDTH } from '../types/app';
import { loadOutlineOpenByFileType, saveOutlineOpenByFileType } from '../utils/settings';
import type { OutlineOpenByFileType } from '../utils/settings';

// Single source of truth for the mobile-shell switch: ≤768px wide, or a
// short landscape touch device (phone rotated) that still needs the shell.
// Keep in sync with the gate in index.css:
// `@media (max-width: 768px), (max-height: 500px) and (pointer: coarse)`.
export const MOBILE_SHELL_MEDIA =
  '(max-width: 768px), (max-height: 500px) and (pointer: coarse)';

const [activeTab, setActiveTab] = createSignal<TabType>('preview');
const [gitPanelOpen, setGitPanelOpen] = createSignal(false);
const [outlineOpen, setOutlineOpen] = createSignal(false);
const [annotationsOpen, setAnnotationsOpen] = createSignal(false);
const [settingsOpen, setSettingsOpen] = createSignal(false);
const [isMobile, setIsMobile] = createSignal(false);
const [sidebarWidth, setSidebarWidth] = createSignal(280);
const [sidebarOpen, setSidebarOpen] = createSignal(true);
const [isDragging, setIsDragging] = createSignal(false);
const [outlineWidth, setOutlineWidth] = createSignal(DEFAULT_OUTLINE_WIDTH);
const [isOutlineDragging, setIsOutlineDragging] = createSignal(false);
const [outlineDragOrigin, setOutlineDragOrigin] = createSignal({ pointerX: 0, width: 0 });
const [annotationColumnWidth, setAnnotationColumnWidth] = createSignal(DEFAULT_ANNOTATION_COLUMN_WIDTH);
const [isAnnotationColumnDragging, setIsAnnotationColumnDragging] = createSignal(false);
const [annotationColumnDragOrigin, setAnnotationColumnDragOrigin] = createSignal({ pointerX: 0, width: 0 });
const [openProjectDialogOpen, setOpenProjectDialogOpen] = createSignal(false);
const [colorPickerOpen, setColorPickerOpen] = createSignal(false);
const [colorPickerProjectId, setColorPickerProjectId] = createSignal<number | null>(null);
const [colorPickerPosition, setColorPickerPosition] = createSignal({ x: 0, y: 0 });
const [projectEditDialogOpen, setProjectEditDialogOpen] = createSignal(false);
const [trashDialogOpen, setTrashDialogOpen] = createSignal(false);
const [outlineOpenByFileType, setOutlineOpenByFileTypeState] = createSignal<OutlineOpenByFileType>(loadOutlineOpenByFileType());

export const appStore = {
  activeTab,
  setActiveTab,
  gitPanelOpen,
  setGitPanelOpen,
  outlineOpen,
  setOutlineOpen,
  annotationsOpen,
  setAnnotationsOpen,
  settingsOpen,
  setSettingsOpen,
  isMobile,
  setIsMobile,
  sidebarWidth,
  setSidebarWidth,
  sidebarOpen,
  setSidebarOpen,
  isDragging,
  setIsDragging,
  outlineWidth,
  setOutlineWidth,
  isOutlineDragging,
  setIsOutlineDragging,
  outlineDragOrigin,
  setOutlineDragOrigin,
  annotationColumnWidth,
  setAnnotationColumnWidth,
  isAnnotationColumnDragging,
  setIsAnnotationColumnDragging,
  annotationColumnDragOrigin,
  setAnnotationColumnDragOrigin,
  openProjectDialogOpen,
  setOpenProjectDialogOpen,
  colorPickerOpen,
  setColorPickerOpen,
  colorPickerProjectId,
  setColorPickerProjectId,
  colorPickerPosition,
  setColorPickerPosition,
  projectEditDialogOpen,
  setProjectEditDialogOpen,
  trashDialogOpen,
  setTrashDialogOpen,

  toggleGitPanel() {
    setGitPanelOpen(!gitPanelOpen());
  },

  toggleOutline() {
    setOutlineOpen(!outlineOpen());
  },

  toggleAnnotations() {
    setAnnotationsOpen(!annotationsOpen());
  },

  toggleSidebar() {
    setSidebarOpen(!sidebarOpen());
  },

  toggleSettings() {
    setSettingsOpen(!settingsOpen());
  },

  openOpenProjectDialog() {
    setOpenProjectDialogOpen(true);
  },

  closeOpenProjectDialog() {
    setOpenProjectDialogOpen(false);
  },

  openColorPicker(projectId: number, x: number, y: number) {
    setColorPickerProjectId(projectId);
    setColorPickerPosition({ x, y });
    setColorPickerOpen(true);
  },

  closeColorPicker() {
    setColorPickerOpen(false);
    setColorPickerProjectId(null);
  },

  openProjectEditDialog() {
    setProjectEditDialogOpen(true);
  },

  closeProjectEditDialog() {
    setProjectEditDialogOpen(false);
  },

  openTrashDialog() {
    setTrashDialogOpen(true);
  },

  closeTrashDialog() {
    setTrashDialogOpen(false);
  },

  initOutlineWidth(width: number) {
    setOutlineWidth(width);
  },

  initAnnotationColumnWidth(width: number) {
    setAnnotationColumnWidth(width);
  },

  checkMobile() {
    setIsMobile(window.matchMedia(MOBILE_SHELL_MEDIA).matches);
  },

  getOutlineOpenForFileType(fileType: 'markdown' | 'html' | 'other'): boolean {
    return outlineOpenByFileType()[fileType];
  },

  setOutlineOpenForFileType(fileType: 'markdown' | 'html' | 'other', open: boolean): void {
    setOutlineOpenByFileTypeState(prev => {
      const updated = { ...prev, [fileType]: open };
      saveOutlineOpenByFileType(updated);
      return updated;
    });
  },
};

export default appStore;