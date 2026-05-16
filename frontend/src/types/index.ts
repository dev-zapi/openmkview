export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  fileType?: DocumentFileType | 'image';
}

export type DocumentFileType = 'markdown' | 'html';

export type FileType = DocumentFileType | 'image';

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export interface FileContent {
  content: string;
  fileName: string;
  path: string;  // Relative path from project root
  fileSize?: number;
  lastModified?: string;
}

export interface FileSaveRequest {
  project_id: number;
  relativePath: string;
  content: string;
  expectedModifiedAt?: string;
}

export interface FileSaveResponse {
  success: boolean;
  fileSize: number;
  lastModified: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitDiff {
  oldContent: string;
  newContent: string;
  oldFileName: string;
  newFileName: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'normal';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface Project {
  id: number;
  name: string;
  path: string;
  color?: string;
  icon?: string;
}

export interface TrashItem {
  id: string;
  originalName: string;
  originalPath: string;
  deletedAt: string;
  isFolder: boolean;
  size: number;
}

export interface TrashStats {
  totalItems: number;
  totalSize: number;
  oldestItemAge: number;
}
