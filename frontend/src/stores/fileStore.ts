import { createSignal } from 'solid-js';
import type { FileContent, Heading, FileNode } from '../types';

type FileType = 'markdown' | 'image';

const [currentFile, setCurrentFile] = createSignal<FileContent | null>(null);
const [currentFileType, setCurrentFileType] = createSignal<FileType>('markdown');
const [extractedHeadings, setExtractedHeadings] = createSignal<Heading[]>([]);
const [imagePreviewUrl, setImagePreviewUrl] = createSignal<string | null>(null);
const [imageFileName, setImageFileName] = createSignal<string>('');
const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set<string>());
const [loading, setLoading] = createSignal<boolean>(false);
const [fileTree, setFileTree] = createSignal<FileNode[]>([]);

export const fileStore = {
  currentFile,
  setCurrentFile,
  currentFileType,
  setCurrentFileType,
  extractedHeadings,
  setExtractedHeadings,
  imagePreviewUrl,
  setImagePreviewUrl,
  imageFileName,
  setImageFileName,
  expandedFolders,
  setExpandedFolders,
  loading,
  setLoading,
  fileTree,
  setFileTree,

  setHeadings(headings: Heading[]) {
    setExtractedHeadings(headings);
  },

  openMarkdownFile(file: FileContent) {
    setCurrentFile(file);
    setCurrentFileType('markdown');
    setImagePreviewUrl(null);
    setImageFileName('');
    setExtractedHeadings([]);
  },

  openImageFile(url: string, fileName: string) {
    setCurrentFile(null);
    setCurrentFileType('image');
    setImagePreviewUrl(url);
    setImageFileName(fileName);
    setExtractedHeadings([]);
  },

  closeFile() {
    setCurrentFile(null);
    setCurrentFileType('markdown');
    setImagePreviewUrl(null);
    setImageFileName('');
    setExtractedHeadings([]);
  },

  toggleFolder(path: string, expanded: boolean) {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(path);
      } else {
        newSet.delete(path);
      }
      return newSet;
    });
  },

  isFolderExpanded(path: string): boolean {
    return expandedFolders().has(path);
  },

  clearExpandedFolders() {
    setExpandedFolders(new Set<string>());
  },

  startLoading() {
    setLoading(true);
  },

  finishLoading() {
    setLoading(false);
  },

  reset() {
    setCurrentFile(null);
    setCurrentFileType('markdown');
    setExtractedHeadings([]);
    setImagePreviewUrl(null);
    setImageFileName('');
    setExpandedFolders(new Set<string>());
    setLoading(false);
  },

  findNodeByPath(path: string): FileNode | null {
    const nodes = fileTree();
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeRecursive(node.children, path);
        if (found) return found;
      }
    }
    return null;
  },
};

function findNodeRecursive(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeRecursive(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export default fileStore;
