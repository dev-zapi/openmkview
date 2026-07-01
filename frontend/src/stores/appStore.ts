import { createSignal } from 'solid-js';
import type { TabType } from '../components/markdown-header/ViewTabs';
import { DEFAULT_OUTLINE_WIDTH } from '../types/app';

const [activeTab, setActiveTab] = createSignal<TabType>('preview');
const [gitPanelOpen, setGitPanelOpen] = createSignal(false);
const [outlineOpen, setOutlineOpen] = createSignal(false);
const [settingsOpen, setSettingsOpen] = createSignal(false);
const [isMobile, setIsMobile] = createSignal(false);
const [sidebarWidth, setSidebarWidth] = createSignal(280);
const [isDragging, setIsDragging] = createSignal(false);
const [outlineWidth, setOutlineWidth] = createSignal(DEFAULT_OUTLINE_WIDTH);
const [isOutlineDragging, setIsOutlineDragging] = createSignal(false);
const [openProjectDialogOpen, setOpenProjectDialogOpen] = createSignal(false);
const [colorPickerOpen, setColorPickerOpen] = createSignal(false);
const [colorPickerProjectId, setColorPickerProjectId] = createSignal<number | null>(null);
const [colorPickerPosition, setColorPickerPosition] = createSignal({ x: 0, y: 0 });
const [projectEditDialogOpen, setProjectEditDialogOpen] = createSignal(false);
const [trashDialogOpen, setTrashDialogOpen] = createSignal(false);

export const appStore = {
  activeTab,
  setActiveTab,
  gitPanelOpen,
  setGitPanelOpen,
  outlineOpen,
  setOutlineOpen,
  settingsOpen,
  setSettingsOpen,
  isMobile,
  setIsMobile,
  sidebarWidth,
  setSidebarWidth,
  isDragging,
  setIsDragging,
  outlineWidth,
  setOutlineWidth,
  isOutlineDragging,
  setIsOutlineDragging,
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

  checkMobile() {
    setIsMobile(window.innerWidth < 768);
  },
};

export default appStore;