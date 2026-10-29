export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  fileType?: DocumentFileType | 'image' | 'other';
  /** True when any path component starts with a dot (Hidden Entry). */
  hidden?: boolean;
  /** True for Placeholder Directories: visible but not expandable. */
  isPlaceholder?: boolean;
  /** File size in bytes (0 for directories). */
  size?: number;
}

export type DocumentFileType = 'markdown' | 'html';

export type FileType = DocumentFileType | 'image' | 'other';

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
  /** Content was cut at the 1 MB limit. */
  truncated?: boolean;
  /** Source bytes were not valid UTF-8 and were lossily decoded. */
  lossy?: boolean;
  /** File looks binary and cannot be previewed. */
  binary?: boolean;
  /** Byte size reported by the content endpoint. */
  size?: number;
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
