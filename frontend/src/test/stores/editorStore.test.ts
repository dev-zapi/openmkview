import { describe, it, expect, beforeEach } from 'vitest';
import { editorStore } from '../../stores/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    editorStore.reset();
  });

  describe('initialization', () => {
    it('has empty initial content', () => {
      expect(editorStore.editContent()).toBe('');
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
    it('sets both edit and original content', () => {
      editorStore.initialize('# Hello World');
      expect(editorStore.editContent()).toBe('# Hello World');
      expect(editorStore.originalContent()).toBe('# Hello World');
    });

    it('clears dirty state after initialization', () => {
      editorStore.initialize('# Test');
      expect(editorStore.isDirty()).toBe(false);
    });
  });

  describe('updateContent', () => {
    it('updates edit content', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      expect(editorStore.editContent()).toBe('modified');
    });

    it('marks dirty when content differs from original', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      expect(editorStore.isDirty()).toBe(true);
    });

    it('clears dirty when content matches original', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      editorStore.updateContent('original');
      expect(editorStore.isDirty()).toBe(false);
    });
  });

  describe('markSaved', () => {
    it('clears dirty state', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      editorStore.markSaved();
      expect(editorStore.isDirty()).toBe(false);
    });

    it('updates original content when provided', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      editorStore.markSaved('new saved content');
      expect(editorStore.originalContent()).toBe('new saved content');
      expect(editorStore.editContent()).toBe('new saved content');
    });

    it('uses current edit content when not provided', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      editorStore.markSaved();
      expect(editorStore.originalContent()).toBe('modified');
    });
  });

  describe('discardChanges', () => {
    it('restores original content', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
      editorStore.discardChanges();
      expect(editorStore.editContent()).toBe('original');
    });

    it('clears dirty state', () => {
      editorStore.initialize('original');
      editorStore.updateContent('modified');
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
      editorStore.updateContent('modified');
      editorStore.startSaving();
      editorStore.reset();
      expect(editorStore.editContent()).toBe('');
      expect(editorStore.originalContent()).toBe('');
      expect(editorStore.isDirty()).toBe(false);
      expect(editorStore.saving()).toBe(false);
    });
  });
});