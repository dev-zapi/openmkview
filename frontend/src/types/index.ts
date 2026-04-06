export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
}

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export interface FileContent {
  content: string;
  fileName: string;
  path: string;
  fileSize?: number;
  lastModified?: string;
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
}
