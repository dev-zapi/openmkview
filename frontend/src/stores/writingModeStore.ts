import { createSignal } from 'solid-js';

/**
 * Per-file Writing Mode state. Session-scoped only: this store is never
 * written to localStorage or the settings API, so a reload always starts in
 * regular Edit Mode.
 */
export interface WritingSession {
  writing: boolean;
  typewriter: boolean;
  focus: boolean;
}

const OFF_SESSION: WritingSession = { writing: false, typewriter: false, focus: false };

/**
 * First entry to Writing Mode for a file starts with every enhancement on;
 * afterwards the remembered per-file values apply.
 */
const FIRST_ENTRY_SESSION: WritingSession = { writing: true, typewriter: true, focus: true };

const [sessions, setSessions] = createSignal<Map<string, WritingSession>>(new Map());

const getSession = (path: string): WritingSession => sessions().get(path) ?? OFF_SESSION;

const toggleWriting = (path: string) => {
  const current = sessions().get(path);
  const next: WritingSession = current
    ? { ...current, writing: !current.writing }
    : { ...FIRST_ENTRY_SESSION };

  // A fresh Map keeps Solid's default referential equality honest.
  setSessions(new Map(sessions()).set(path, next));
};

const toggleFocus = (path: string) => {
  const current = sessions().get(path) ?? OFF_SESSION;
  const next: WritingSession = { ...current, focus: !current.focus };

  setSessions(new Map(sessions()).set(path, next));
};

const reset = () => {
  setSessions(new Map());
};

export const writingModeStore = {
  sessions,
  getSession,
  toggleWriting,
  toggleFocus,
  reset,
};

export default writingModeStore;
