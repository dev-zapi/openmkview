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
      const result = await api.getProjects({ openOnly: true });
      expect(result).toEqual(mockProjects);
      expect(global.fetch).toHaveBeenCalledWith('/api/projects?open=true');
    });

    it('requests all projects when no filter is provided', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', path: '/path/to/project1' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockProjects,
      });

      const { api } = await import('../services/api');
      const result = await api.getProjects();
      expect(result).toEqual(mockProjects);
      expect(global.fetch).toHaveBeenCalledWith('/api/projects');
    });

    it('throws error when project list request fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      const { api } = await import('../services/api');
      await expect(api.getProjects({ openOnly: true })).rejects.toThrow('Internal server error');
      expect(global.fetch).toHaveBeenCalledWith('/api/projects?open=true');
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
        path: 'README.md',
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockContent,
      });

      const { api } = await import('../services/api');
      const result = await api.getFileContent('README.md', 1);
      expect(result).toEqual(mockContent);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/content?relativePath=README.md&project_id=1'
      );
    });
  });

  describe('saveFileContent', () => {
    it('saves file content successfully', async () => {
      const mockResponse = {
        success: true,
        fileSize: 100,
        lastModified: '2024-01-15T10:30:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { api } = await import('../services/api');
      const result = await api.saveFileContent('docs/test.md', '# Updated content', 1);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/content',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 1,
            relativePath: 'docs/test.md',
            content: '# Updated content',
            expectedModifiedAt: undefined,
          }),
        })
      );
    });

    it('saves file with optimistic concurrency timestamp', async () => {
      const mockResponse = {
        success: true,
        fileSize: 100,
        lastModified: '2024-01-15T11:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { api } = await import('../services/api');
      const expectedModifiedAt = '2024-01-15T10:00:00Z';
      const result = await api.saveFileContent('docs/test.md', '# Content', 1, expectedModifiedAt);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/content',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 1,
            relativePath: 'docs/test.md',
            content: '# Content',
            expectedModifiedAt,
          }),
        })
      );
    });

    it('throws error on conflict response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Conflict: File has been modified externally. Please reload and try again.' }),
      });

      const { api } = await import('../services/api');
      await expect(api.saveFileContent('docs/test.md', '# Content', 1)).rejects.toThrow('Conflict');
    });

    it('throws error on validation failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Only Markdown files (.md/.mdx) can be edited' }),
      });

      const { api } = await import('../services/api');
      await expect(api.saveFileContent('test.txt', 'Content', 1)).rejects.toThrow('Only Markdown files');
    });

    it('throws error on server failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      const { api } = await import('../services/api');
      await expect(api.saveFileContent('test.md', 'Content', 1)).rejects.toThrow('Internal server error');
    });

    it('handles network error gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { api } = await import('../services/api');
      await expect(api.saveFileContent('test.md', 'Content', 1)).rejects.toThrow('Network error');
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
          id: '550e8400-e29b-41d4-a716-446655440000',
          originalName: 'test.md',
          originalPath: 'docs/test.md',
          deletedAt: '2024-01-15T10:30:00Z',
          isFolder: false,
          size: 100,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
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
            body: JSON.stringify({ projectId: 1, path: 'docs/test.md', isFolder: false }),
          })
        );
      });

      it('throws error on non-2xx response', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: '路径非法' }),
        });

        const { api } = await import('../services/api');
        await expect(api.moveToTrash('../escape.md', 1, false)).rejects.toThrow('路径非法');
      });
    });

    describe('restoreFromTrash', () => {
      it('restores file from trash', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        const { api } = await import('../services/api');
        await api.restoreFromTrash('550e8400-e29b-41d4-a716-446655440000', 1);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/trash/restore',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: 1, trashItemId: '550e8400-e29b-41d4-a716-446655440000' }),
          })
        );
      });

      it('throws error on restore failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: '目标路径已存在' }),
        });

        const { api } = await import('../services/api');
        await expect(api.restoreFromTrash('550e8400-e29b-41d4-a716-446655440000', 1)).rejects.toThrow('目标路径已存在');
      });
    });

    describe('deleteFromTrash', () => {
      it('permanently deletes from trash', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        const { api } = await import('../services/api');
        await api.deleteFromTrash('550e8400-e29b-41d4-a716-446655440000', 1);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/trash/item',
          expect.objectContaining({
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: 1, trashItemId: '550e8400-e29b-41d4-a716-446655440000' }),
          })
        );
      });

      it('throws error on delete failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: '回收站项目不存在' }),
        });

        const { api } = await import('../services/api');
        await expect(api.deleteFromTrash('invalid-id', 1)).rejects.toThrow('回收站项目不存在');
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
            body: JSON.stringify({ projectId: 1 }),
          })
        );
      });

      it('throws error on clear failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        });

        const { api } = await import('../services/api');
        await expect(api.clearTrash(1)).rejects.toThrow();
      });
    });

    describe('listTrash', () => {
      it('returns list of trash items', async () => {
        const mockTrashItems = [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            originalName: 'test.md',
            originalPath: 'docs/test.md',
            deletedAt: '2024-01-15T10:30:00Z',
            isFolder: false,
            size: 100,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            originalName: 'old-folder',
            originalPath: 'docs/old-folder',
            deletedAt: '2024-01-01T10:00:00Z',
            isFolder: true,
            size: 5000,
          },
        ];

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockTrashItems,
        });

        const { api } = await import('../services/api');
        const result = await api.listTrash(1);
        expect(result).toEqual(mockTrashItems);
        expect(global.fetch).toHaveBeenCalledWith('/api/trash/list?project_id=1');
      });

      it('throws error on list failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Project not found' }),
        });

        const { api } = await import('../services/api');
        await expect(api.listTrash(999)).rejects.toThrow('Project not found');
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
          ok: true,
          json: async () => mockStats,
        });

        const { api } = await import('../services/api');
        const result = await api.getTrashStats(1);
        expect(result).toEqual(mockStats);
        expect(global.fetch).toHaveBeenCalledWith('/api/trash/stats?project_id=1');
      });

      it('throws error on stats failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Project not found' }),
        });

        const { api } = await import('../services/api');
        await expect(api.getTrashStats(999)).rejects.toThrow('Project not found');
      });
    });
  });
});
