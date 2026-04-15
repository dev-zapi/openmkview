import { createSignal } from 'solid-js';

const [editContent, setEditContent] = createSignal<string>('');
const [originalContent, setOriginalContent] = createSignal<string>('');
const [isDirty, setIsDirty] = createSignal<boolean>(false);
const [saving, setSaving] = createSignal<boolean>(false);

export const editorStore = {
  editContent,
  setEditContent,
  originalContent,
  setOriginalContent,
  isDirty,
  setIsDirty,
  saving,
  setSaving,

  initialize(content: string) {
    setEditContent(content);
    setOriginalContent(content);
    setIsDirty(false);
  },

  updateContent(newContent: string) {
    setEditContent(newContent);
    setIsDirty(newContent !== originalContent());
  },

  markSaved(content?: string) {
    if (content) {
      setEditContent(content);
      setOriginalContent(content);
    } else {
      setOriginalContent(editContent());
    }
    setIsDirty(false);
  },

  discardChanges() {
    setEditContent(originalContent());
    setIsDirty(false);
  },

  startSaving() {
    setSaving(true);
  },

  finishSaving() {
    setSaving(false);
  },

  reset() {
    setEditContent('');
    setOriginalContent('');
    setIsDirty(false);
    setSaving(false);
  },
};

export default editorStore;