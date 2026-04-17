import { describe, it, expect } from 'vitest';
import { formatTrashDate, formatTrashSize } from '../../utils/trash';

describe('trash utils', () => {
  it('formats trash sizes', () => {
    expect(formatTrashSize(512)).toBe('512 B');
    expect(formatTrashSize(1536)).toBe('1.5 KB');
    expect(formatTrashSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('formats trash dates relative to now', () => {
    const now = new Date('2026-04-17T12:00:00Z');

    expect(formatTrashDate('2026-04-17T10:00:00Z', now)).toBe('Today');
    expect(formatTrashDate('2026-04-16T10:00:00Z', now)).toBe('Yesterday');
    expect(formatTrashDate('2026-04-14T10:00:00Z', now)).toBe('3 days ago');
  });

  it('uses calendar days instead of elapsed hours', () => {
    const now = new Date('2026-04-17T00:01:00');

    expect(formatTrashDate('2026-04-16T23:59:00', now)).toBe('Yesterday');
  });

  it('clamps future dates to today', () => {
    const now = new Date('2026-04-17T12:00:00Z');

    expect(formatTrashDate('2026-04-18T10:00:00Z', now)).toBe('Today');
  });

  it('returns an empty label for invalid dates', () => {
    expect(formatTrashDate('not-a-date')).toBe('');
  });
});
