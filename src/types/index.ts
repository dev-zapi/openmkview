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
