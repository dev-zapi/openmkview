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
});
