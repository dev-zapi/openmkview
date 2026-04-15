import { describe, it, expect, beforeEach } from 'vitest';
import { fileStore } from '../../stores/fileStore';
import type { FileContent, FileNode, Heading } from '../../types';

describe('fileStore', () => {
  beforeEach(() => {
    fileStore.reset();
    fileStore.clearExpandedFolders();
    fileStore.setFileTree([]);
  });

  describe('initial state', () => {
    it('has no current file', () => {
      expect(fileStore.currentFile()).toBe(null);
    });

    it('has markdown as default file type', () => {
      expect(fileStore.currentFileType()).toBe('markdown');
    });

    it('has no image preview', () => {
      expect(fileStore.imagePreviewUrl()).toBe(null);
      expect(fileStore.imageFileName()).toBe('');
    });

    it('has empty headings', () => {
      expect(fileStore.extractedHeadings()).toEqual([]);
    });

    it('is not loading', () => {
      expect(fileStore.loading()).toBe(false);
    });
  });

  describe('openMarkdownFile', () => {
    it('sets current file', () => {
      const file: FileContent = {
        content: '# Hello',
        fileName: 'test.md',
        path: 'test.md',
      };
      fileStore.openMarkdownFile(file);
      expect(fileStore.currentFile()).toEqual(file);
    });

    it('sets file type to markdown', () => {
      const file: FileContent = {
        content: '# Hello',
        fileName: 'test.md',
        path: 'test.md',
      };
      fileStore.openMarkdownFile(file);
      expect(fileStore.currentFileType()).toBe('markdown');
    });

    it('clears image preview', () => {
      fileStore.openImageFile('/image.png', 'image.png');
      const file: FileContent = {
        content: '# Hello',
        fileName: 'test.md',
        path: 'test.md',
      };
      fileStore.openMarkdownFile(file);
      expect(fileStore.imagePreviewUrl()).toBe(null);
    });
  });

  describe('openImageFile', () => {
    it('sets image preview URL', () => {
      fileStore.openImageFile('/test.png', 'test.png');
      expect(fileStore.imagePreviewUrl()).toBe('/test.png');
    });

    it('sets image file name', () => {
      fileStore.openImageFile('/test.png', 'test.png');
      expect(fileStore.imageFileName()).toBe('test.png');
    });

    it('sets file type to image', () => {
      fileStore.openImageFile('/test.png', 'test.png');
      expect(fileStore.currentFileType()).toBe('image');
    });

    it('clears current file', () => {
      const file: FileContent = {
        content: '# Hello',
        fileName: 'test.md',
        path: 'test.md',
      };
      fileStore.openMarkdownFile(file);
      fileStore.openImageFile('/test.png', 'test.png');
      expect(fileStore.currentFile()).toBe(null);
    });
  });

  describe('closeFile', () => {
    it('clears all file state', () => {
      fileStore.openMarkdownFile({
        content: '# Hello',
        fileName: 'test.md',
        path: 'test.md',
      });
      fileStore.closeFile();
      expect(fileStore.currentFile()).toBe(null);
      expect(fileStore.imagePreviewUrl()).toBe(null);
    });
  });

  describe('headings', () => {
    it('can set headings', () => {
      const headings: Heading[] = [
        { depth: 1, text: 'Title', id: 'title' },
        { depth: 2, text: 'Subtitle', id: 'subtitle' },
      ];
      fileStore.setHeadings(headings);
      expect(fileStore.extractedHeadings()).toEqual(headings);
    });
  });

  describe('expandedFolders', () => {
    it('can toggle folder expanded', () => {
      fileStore.toggleFolder('/src', true);
      expect(fileStore.isFolderExpanded('/src')).toBe(true);
    });

    it('can toggle folder collapsed', () => {
      fileStore.toggleFolder('/src', true);
      fileStore.toggleFolder('/src', false);
      expect(fileStore.isFolderExpanded('/src')).toBe(false);
    });

    it('can clear all expanded folders', () => {
      fileStore.toggleFolder('/src', true);
      fileStore.toggleFolder('/dist', true);
      fileStore.clearExpandedFolders();
      expect(fileStore.isFolderExpanded('/src')).toBe(false);
      expect(fileStore.isFolderExpanded('/dist')).toBe(false);
    });
  });

  describe('loading state', () => {
    it('can start loading', () => {
      fileStore.startLoading();
      expect(fileStore.loading()).toBe(true);
    });

    it('can finish loading', () => {
      fileStore.startLoading();
      fileStore.finishLoading();
      expect(fileStore.loading()).toBe(false);
    });
  });

  describe('fileTree', () => {
    it('can set file tree', () => {
      const tree: FileNode[] = [
        { id: '1', name: 'file.md', path: 'file.md', isFolder: false },
      ];
      fileStore.setFileTree(tree);
      expect(fileStore.fileTree()).toEqual(tree);
    });
  });

  describe('findNodeByPath', () => {
    it('finds node in flat tree', () => {
      const tree: FileNode[] = [
        { id: '1', name: 'file.md', path: 'file.md', isFolder: false },
        { id: '2', name: 'other.md', path: 'other.md', isFolder: false },
      ];
      fileStore.setFileTree(tree);
      const found = fileStore.findNodeByPath('file.md');
      expect(found?.name).toBe('file.md');
    });

    it('finds node in nested tree', () => {
      const tree: FileNode[] = [
        {
          id: '1',
          name: 'src',
          path: 'src',
          isFolder: true,
          children: [
            { id: '2', name: 'index.md', path: 'src/index.md', isFolder: false },
          ],
        },
      ];
      fileStore.setFileTree(tree);
      const found = fileStore.findNodeByPath('src/index.md');
      expect(found?.name).toBe('index.md');
    });

    it('returns null when not found', () => {
      fileStore.setFileTree([]);
      const found = fileStore.findNodeByPath('nonexistent.md');
      expect(found).toBe(null);
    });
  });
});