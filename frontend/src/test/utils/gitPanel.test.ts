import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

import { getStatusColor, getStatusLabel, runGitAction } from '../../utils/gitPanel';

describe('gitPanel utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps git statuses to css classes', () => {
    expect(getStatusColor('M', ' ')).toBe('status-modified');
    expect(getStatusColor('?', '?')).toBe('status-untracked');
    expect(getStatusColor('A', ' ')).toBe('status-added');
    expect(getStatusColor('D', ' ')).toBe('status-deleted');
  });

  it('maps git statuses to labels', () => {
    expect(getStatusLabel('M', ' ')).toBe('M');
    expect(getStatusLabel('?', '?')).toBe('U');
    expect(getStatusLabel('A', ' ')).toBe('A');
    expect(getStatusLabel('D', ' ')).toBe('D');
  });

  it('posts git actions with optional commit message', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => '' } as Response);

    await runGitAction(1, 'commit', 'message');

    expect(fetch).toHaveBeenCalledWith('/api/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'commit', project_id: 1, message: 'message' }),
    });
  });

  it('throws when git action response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, text: async () => 'Push failed' } as Response);

    await expect(runGitAction(1, 'push')).rejects.toThrow('Push failed');
  });
});
