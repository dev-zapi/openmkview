import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjects', () => {
    it('returns list of projects', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', path: '/path/to/project1' },
        { id: 2, name: 'Project 2', path: '/path/to/project2' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockProjects,
      });

      const { api } = await import('../services/api');
      const result = await api.getProjects();
      expect(result).toEqual(mockProjects);
      expect(global.fetch).toHaveBeenCalledWith('/api/projects');
    });
  });

  describe('getFileTree', () => {
    it('returns file tree for project', async () => {
      const mockTree = [
        {
          name: 'src',
          path: '/project/src',
          isFolder: true,
          children: [],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockTree,
      });

      const { api } = await import('../services/api');
      const result = await api.getFileTree(1);
      expect(result).toEqual(mockTree);
      expect(global.fetch).toHaveBeenCalledWith('/api/files/tree?project_id=1');
    });
  });

  describe('getFileContent', () => {
    it('returns file content', async () => {
      const mockContent = {
        content: '# Hello World',
        headings: [{ depth: 1, text: 'Hello World', id: 'hello-world' }],
        fileName: 'README.md',
        path: '/project/README.md',
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockContent,
      });

      const { api } = await import('../services/api');
      const result = await api.getFileContent('/project/README.md', 1);
      expect(result).toEqual(mockContent);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/content?path=%2Fproject%2FREADME.md&project_id=1'
      );
    });
  });

  describe('createProject', () => {
    it('creates a new project', async () => {
      const mockProject = { id: 3, name: 'New Project', path: '/path/to/new' };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockProject,
      });

      const { api } = await import('../services/api');
      const result = await api.createProject('/path/to/new');
      expect(result).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/path/to/new' }),
        })
      );
    });
  });

  describe('Trash API', () => {
    describe('moveToTrash', () => {
      it('moves file to trash', async () => {
        const mockTrashItem = {
          id: '1234567890_test.md',
          originalName: 'test.md',
          originalPath: 'docs/test.md',
          deletedAt: '2024-01-15T10:30:00Z',
          isFolder: false,
          size: 100,
        };

        (global.fetch as any).mockResolvedValueOnce({
          json: async () => mockTrashItem,
        });

        const { api } = await import('../services/api');
        const result = await api.moveToTrash('docs/test.md', 1, false);
        expect(result).toEqual(mockTrashItem);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/trash/move',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: 1, path: 'docs/test.md', is_folder: false }),
          })
        );
      });
    });

    describe('restoreFromTrash', () => {
      it('restores file from trash', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        const { api } = await import('../services/api');
        await api.restoreFromTrash('1234567890_test.md', 1);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/trash/restore',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: 1, trash_item_id: '1234567890_test.md' }),
          })
        );
      });
    });

    describe('deleteFromTrash', () => {
      it('permanently deletes from trash', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        const { api } = await import('../services/api');
        await api.deleteFromTrash('1234567890_test.md', 1);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/trash/item',
          expect.objectContaining({
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: 1, trash_item_id: '1234567890_test.md' }),
          })
        );
      });
    });

    describe('clearTrash', () => {
      it('clears all trash items', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        const { api } = await import('../services/api');
        await api.clearTrash(1);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/trash/clear',
          expect.objectContaining({
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: 1 }),
          })
        );
      });
    });

    describe('listTrash', () => {
      it('returns list of trash items', async () => {
        const mockTrashItems = [
          {
            id: '1234567890_test.md',
            originalName: 'test.md',
            originalPath: 'docs/test.md',
            deletedAt: '2024-01-15T10:30:00Z',
            isFolder: false,
            size: 100,
          },
          {
            id: '1234567891_old-folder',
            originalName: 'old-folder',
            originalPath: 'docs/old-folder',
            deletedAt: '2024-01-01T10:00:00Z',
            isFolder: true,
            size: 5000,
          },
        ];

        (global.fetch as any).mockResolvedValueOnce({
          json: async () => mockTrashItems,
        });

        const { api } = await import('../services/api');
        const result = await api.listTrash(1);
        expect(result).toEqual(mockTrashItems);
        expect(global.fetch).toHaveBeenCalledWith('/api/trash/list?project_id=1');
      });
    });

    describe('getTrashStats', () => {
      it('returns trash statistics', async () => {
        const mockStats = {
          totalItems: 5,
          totalSize: 1200000,
          oldestItemAge: 15,
        };

        (global.fetch as any).mockResolvedValueOnce({
          json: async () => mockStats,
        });

        const { api } = await import('../services/api');
        const result = await api.getTrashStats(1);
        expect(result).toEqual(mockStats);
        expect(global.fetch).toHaveBeenCalledWith('/api/trash/stats?project_id=1');
      });
    });
  });
});
