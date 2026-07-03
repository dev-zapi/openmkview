import { createSignal } from 'solid-js';

const [originalContent, setOriginalContent] = createSignal<string>('');
const [isDirty, setIsDirty] = createSignal<boolean>(false);
const [saving, setSaving] = createSignal<boolean>(false);

export const editorStore = {
  originalContent,
  isDirty,
  saving,

  initialize(content: string) {
    setOriginalContent(content);
    setIsDirty(false);
  },

  setDirty(dirty: boolean) {
    setIsDirty(dirty);
  },

  markSaved(content: string) {
    setOriginalContent(content);
    setIsDirty(false);
  },

  discardChanges() {
    setIsDirty(false);
  },

  startSaving() {
    setSaving(true);
  },

  finishSaving() {
    setSaving(false);
  },

  reset() {
    setOriginalContent('');
    setIsDirty(false);
    setSaving(false);
  },
};

export default editorStore;