import { createSignal } from 'solid-js';
import type { FileContent, Heading, FileNode } from '../types';

type FileType = 'markdown' | 'image';

const [currentFile, setCurrentFile] = createSignal<FileContent | null>(null);
const [currentFileType, setCurrentFileType] = createSignal<FileType>('markdown');
const [extractedHeadings, setExtractedHeadings] = createSignal<Heading[]>([]);
const [imagePreviewUrl, setImagePreviewUrl] = createSignal<string | null>(null);
const [imageFileName, setImageFileName] = createSignal<string>('');
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
