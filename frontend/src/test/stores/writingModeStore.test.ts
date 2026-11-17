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

  describe('toggleFocus', () => {
    it('starts on when Writing Mode is first entered for a file', () => {
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').focus).toBe(true);
    });

    it('turns Paragraph Focus off while leaving the other toggles untouched', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleFocus('notes/a.md');

      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: true,
        typewriter: true,
        focus: false,
      });
    });

    it('turns Paragraph Focus back on again', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleFocus('notes/a.md');
      writingModeStore.toggleFocus('notes/a.md');

      expect(writingModeStore.getSession('notes/a.md').focus).toBe(true);
    });

    it('survives turning Writing Mode off and on', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleFocus('notes/a.md');
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);

      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);
    });

    it('keeps each file isolated', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleWriting('notes/b.md');
      writingModeStore.toggleFocus('notes/a.md');

      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);
      expect(writingModeStore.getSession('notes/b.md').focus).toBe(true);

      writingModeStore.toggleFocus('notes/b.md');
      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);
      expect(writingModeStore.getSession('notes/b.md').focus).toBe(false);
    });

    it('keeps the same path isolated across projects when keys carry the project id', () => {
      writingModeStore.toggleWriting('1:README.md');
      writingModeStore.toggleFocus('1:README.md');

      expect(writingModeStore.getSession('1:README.md').focus).toBe(false);
      expect(writingModeStore.getSession('2:README.md').focus).toBe(false);
    });

    it('reports Paragraph Focus off for an unseen path', () => {
      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);
    });

    it('does nothing for a file that never entered Writing Mode', () => {
      writingModeStore.toggleFocus('notes/a.md');

      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);
      expect(writingModeStore.sessions().has('notes/a.md')).toBe(false);
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

    it('clears Paragraph Focus state too', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleFocus('notes/a.md');
      writingModeStore.reset();
      // A reset file is unseen, so first-entry defaults apply again.
      expect(writingModeStore.getSession('notes/a.md').focus).toBe(false);
    });
  });
});
