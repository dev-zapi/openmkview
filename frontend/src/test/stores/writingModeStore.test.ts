import { describe, it, expect, beforeEach } from 'vitest';
import { writingModeStore } from '../../stores/writingModeStore';

describe('writingModeStore', () => {
  beforeEach(() => {
    writingModeStore.reset();
  });

  describe('unseen files', () => {
    it('report writing mode off', () => {
      const session = writingModeStore.getSession('notes/a.md');
      expect(session.writing).toBe(false);
    });
  });

  describe('toggleWriting', () => {
    it('seeds the full session on first entry: writing, typewriter, and focus all on', () => {
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: true,
        typewriter: true,
        focus: true,
      });
    });

    it('turns writing off while remembering the sub-toggle state', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: false,
        typewriter: true,
        focus: true,
      });
    });

    it('turns writing back on with the remembered sub-toggle state', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: true,
        typewriter: true,
        focus: true,
      });
    });

    it('keeps each file isolated', () => {
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/b.md').writing).toBe(false);
      expect(writingModeStore.getSession('notes/a.md').writing).toBe(true);

      writingModeStore.toggleWriting('notes/b.md');
      expect(writingModeStore.getSession('notes/a.md').writing).toBe(true);
      expect(writingModeStore.getSession('notes/b.md').writing).toBe(true);

      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').writing).toBe(false);
      expect(writingModeStore.getSession('notes/b.md').writing).toBe(true);
    });

    it('keeps the same path isolated across projects when keys carry the project id', () => {
      writingModeStore.toggleWriting('1:README.md');
      expect(writingModeStore.getSession('2:README.md').writing).toBe(false);
      expect(writingModeStore.getSession('1:README.md').writing).toBe(true);
    });
  });

  describe('reset', () => {
    it('forgets every per-file session', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleWriting('notes/b.md');
      writingModeStore.reset();
      expect(writingModeStore.getSession('notes/a.md').writing).toBe(false);
      expect(writingModeStore.getSession('notes/b.md').writing).toBe(false);
    });
  });
});
