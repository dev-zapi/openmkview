import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  api: {
    getFileRawUrl: vi.fn((relativePath: string, projectId: number) =>
      `/api/files/raw?relativePath=${encodeURIComponent(relativePath)}&project_id=${projectId}`
    ),
  },
}));

import {
  FAVICON_PREFIX,
  getFaviconPath,
  getProjectDisplayName,
  getProjectFaviconUrl,
  getProjectIconContent,
  isFaviconIcon,
} from '../../utils/projectIcon';
import { api } from '../../services/api';

describe('projectIcon utils', () => {
  const project = {
    id: 1,
    name: 'alpha',
    path: '/workspace/alpha',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects favicon icons', () => {
    expect(FAVICON_PREFIX).toBe('favicon:');
    expect(isFaviconIcon('favicon:assets/icon.png')).toBe(true);
    expect(isFaviconIcon('A')).toBe(false);
  });

  it('extracts favicon path', () => {
    expect(getFaviconPath('favicon:assets/icon.png')).toBe('assets/icon.png');
  });

  it('builds project display name fallback', () => {
    expect(getProjectDisplayName(project)).toBe('A');
    expect(getProjectDisplayName({ ...project, icon: 'Z' })).toBe('Z');
  });

  it('builds raw favicon url', () => {
    expect(getProjectFaviconUrl('assets/icon.png', 1)).toBe('/api/files/raw?relativePath=assets%2Ficon.png&project_id=1');
    expect(api.getFileRawUrl).toHaveBeenCalledWith('assets/icon.png', 1);
  });

  it('returns image icon content for favicon icons', () => {
    expect(getProjectIconContent({ ...project, icon: 'favicon:assets/icon.png' })).toEqual({
      type: 'image',
      src: '/api/files/raw?relativePath=assets%2Ficon.png&project_id=1',
    });
  });

  it('returns text icon content for plain icons', () => {
    expect(getProjectIconContent(project)).toEqual({
      type: 'text',
      text: 'A',
    });
  });
});
