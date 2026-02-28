// Shared types for OpenMKView

export interface Project {
  id: number;
  path: string;
  name: string;
  created_at: string;
  last_opened_at: string;
  is_open: boolean;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileTreeNode[];
}

export interface HeadingInfo {
  id: string;
  text: string;
  depth: number;
}

export type ViewMode = "preview" | "source";

export type ThemeMode = "light" | "dark" | "system";

// Settings
export type MarkdownWidthMode = "full" | "fixed";
export type TableWidthMode = "auto" | "full";

export interface MarkdownWidthSetting {
  mode: MarkdownWidthMode;
  fixedWidth: string; // e.g., "70%", "1000px", "800rem"
}

export interface FontSetting {
  fontFamily: string; // CSS font-family value, e.g., "Inter", "system-ui"
  fontSize: string;   // CSS font-size value, e.g., "14px", "1rem"
}

export interface SystemSettings {
  markdownWidth: MarkdownWidthSetting;
  uiFont: FontSetting;
  markdownFont: FontSetting;
  tableWidth: TableWidthMode;
}
