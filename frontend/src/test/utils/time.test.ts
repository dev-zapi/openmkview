import { describe, expect, it } from 'vitest';
import { formatTimestamp, parseTimestamp } from '../../utils/time';

describe('timestamp parsing', () => {
  it('treats SQLite datetime strings as UTC, not local time', () => {
    // SQLite datetime('now') has no zone designator; the same wall-clock
    // instant must parse identically regardless of the machine timezone.
    const parsed = parseTimestamp('2026-11-18 05:16:27');
    expect(parsed?.toISOString()).toBe('2026-11-18T05:16:27.000Z');
  });

  it('handles SQLite fractional seconds as UTC', () => {
    expect(parseTimestamp('2026-11-18 05:16:27.250')?.toISOString()).toBe(
      '2026-11-18T05:16:27.250Z'
    );
  });

  it('keeps explicit ISO zone designators intact', () => {
    expect(parseTimestamp('2026-11-18T05:16:27Z')?.toISOString()).toBe(
      '2026-11-18T05:16:27.000Z'
    );
    expect(parseTimestamp('2026-11-18T13:16:27+08:00')?.toISOString()).toBe(
      '2026-11-18T05:16:27.000Z'
    );
  });

  it('returns null for empty or invalid values', () => {
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('not a date')).toBeNull();
  });

  it('renders every timestamp through the same localized UTC path', () => {
    expect(formatTimestamp('2026-11-18 05:16:27')).toBe(
      new Date('2026-11-18T05:16:27Z').toLocaleString()
    );
    expect(formatTimestamp('not a date')).toBe('not a date');
  });
});
