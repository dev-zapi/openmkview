import { describe, it, expect, beforeEach } from 'vitest';
import { writingModeStore, writingSessionKey } from '../../stores/writingModeStore';

describe('writingModeStore', () => {
  beforeEach(() => {
    writingModeStore.reset();
  });

  describe('writingSessionKey', () => {
    it('scopes the same path to each project', () => {
      expect(writingSessionKey(1, 'README.md')).toBe('1:README.md');
      expect(writingSessionKey(2, 'README.md')).toBe('2:README.md');
    });

    it('falls back to one unknown scope when the project id is missing', () => {
      // Documented limitation: without a project id two distinct files that
      // present the same path share the `'unknown'` scope, so their Writing
      // Mode sessions merge. Different paths still stay separate.
      const samePathFromA = writingSessionKey(undefined, 'README.md');
      const samePathFromB = writingSessionKey(undefined, 'README.md');
      expect(samePathFromA).toBe('unknown:README.md');
      expect(samePathFromB).toBe(samePathFromA);
      expect(writingSessionKey(undefined, 'notes/a.md')).toBe('unknown:notes/a.md');

      writingModeStore.toggleWriting(samePathFromA);
      expect(writingModeStore.getSession(samePathFromB).writing).toBe(true);
      expect(writingModeStore.getSession(writingSessionKey(undefined, 'notes/a.md')).writing).toBe(false);
    });
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

  describe('toggleTypewriter', () => {
    it('defaults typewriter on at first entry to writing mode', () => {
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').typewriter).toBe(true);
    });

    it('turns typewriter off and back on without changing writing or focus', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleTypewriter('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: true,
        typewriter: false,
        focus: true,
      });

      writingModeStore.toggleTypewriter('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: true,
        typewriter: true,
        focus: true,
      });
    });

    it('keeps each file isolated', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleWriting('notes/b.md');
      writingModeStore.toggleTypewriter('notes/a.md');

      expect(writingModeStore.getSession('notes/a.md').typewriter).toBe(false);
      expect(writingModeStore.getSession('notes/b.md').typewriter).toBe(true);
    });

    it('remembers the typewriter preference across writing toggles', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleTypewriter('notes/a.md');
      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').writing).toBe(false);

      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md')).toEqual({
        writing: true,
        typewriter: false,
        focus: true,
      });
    });

    it('does nothing for a file that never entered Writing Mode', () => {
      writingModeStore.toggleTypewriter('notes/a.md');

      expect(writingModeStore.getSession('notes/a.md').typewriter).toBe(false);
      expect(writingModeStore.sessions().has('notes/a.md')).toBe(false);
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

    it('forgets the typewriter preference and restores the first-entry default', () => {
      writingModeStore.toggleWriting('notes/a.md');
      writingModeStore.toggleTypewriter('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').typewriter).toBe(false);

      writingModeStore.reset();
      expect(writingModeStore.getSession('notes/a.md').typewriter).toBe(false);

      writingModeStore.toggleWriting('notes/a.md');
      expect(writingModeStore.getSession('notes/a.md').typewriter).toBe(true);
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
