import { describe, it, expect, beforeEach } from 'vitest';
import { editorStore } from '../../stores/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    editorStore.reset();
  });

  describe('initialization', () => {
    it('has empty original content', () => {
      expect(editorStore.originalContent()).toBe('');
    });

    it('is not dirty initially', () => {
      expect(editorStore.isDirty()).toBe(false);
    });

    it('is not saving initially', () => {
      expect(editorStore.saving()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('sets original content', () => {
      editorStore.initialize('# Hello World');
      expect(editorStore.originalContent()).toBe('# Hello World');
    });

    it('clears dirty state after initialization', () => {
      editorStore.initialize('# Test');
      expect(editorStore.isDirty()).toBe(false);
    });
  });

  describe('setDirty', () => {
    it('sets dirty to true', () => {
      editorStore.setDirty(true);
      expect(editorStore.isDirty()).toBe(true);
    });

    it('sets dirty to false', () => {
      editorStore.setDirty(true);
      editorStore.setDirty(false);
      expect(editorStore.isDirty()).toBe(false);
    });
  });

  describe('markSaved', () => {
    it('clears dirty state', () => {
      editorStore.initialize('original');
      editorStore.setDirty(true);
      editorStore.markSaved('modified');
      expect(editorStore.isDirty()).toBe(false);
    });

    it('updates original content', () => {
      editorStore.initialize('original');
      editorStore.markSaved('new saved content');
      expect(editorStore.originalContent()).toBe('new saved content');
    });
  });

  describe('discardChanges', () => {
    it('clears dirty state', () => {
      editorStore.initialize('original');
      editorStore.setDirty(true);
      editorStore.discardChanges();
      expect(editorStore.isDirty()).toBe(false);
    });
  });

  describe('saving state', () => {
    it('can start saving', () => {
      editorStore.startSaving();
      expect(editorStore.saving()).toBe(true);
    });

    it('can finish saving', () => {
      editorStore.startSaving();
      editorStore.finishSaving();
      expect(editorStore.saving()).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      editorStore.initialize('content');
      editorStore.setDirty(true);
      editorStore.startSaving();
      editorStore.reset();
      expect(editorStore.originalContent()).toBe('');
      expect(editorStore.isDirty()).toBe(false);
      expect(editorStore.saving()).toBe(false);
    });
  });
});
