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

/**
 * Build the per-file session key.
 *
 * In production the project id always comes from the active project
 * (FileContentView passes `activeProjectId`), so the key is unique per file
 * per project. When projectId is missing we fall back to one shared `'unknown'`
 * scope: files remain independent by path, but two distinct files presented
 * with the same path and no project identity share a session. There is no
 * per-file identity to tell them apart without the project id, so this fallback
 * is an explicit limitation, not a safe default.
 */
export const writingSessionKey = (projectId: number | undefined, filePath: string): string =>
  `${projectId ?? 'unknown'}:${filePath}`;

const getSession = (path: string): WritingSession => sessions().get(path) ?? OFF_SESSION;

const toggleWriting = (path: string) => {
  const current = sessions().get(path);
  const next: WritingSession = current
    ? { ...current, writing: !current.writing }
    : { ...FIRST_ENTRY_SESSION };

  // A fresh Map keeps Solid's default referential equality honest.
  setSessions(new Map(sessions()).set(path, next));
};

const toggleTypewriter = (path: string) => {
  const current = sessions().get(path);

  // The sub-toggle only exists inside Writing Mode; an unseen path has no
  // session to adjust, so leave it untouched rather than conjuring one.
  if (!current) return;

  setSessions(new Map(sessions()).set(path, {
    ...current,
    typewriter: !current.typewriter,
  }));
};

const toggleFocus = (path: string) => {
  const current = sessions().get(path);
  // Paragraph Focus only exists inside a Writing Mode session.
  if (!current) return;

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
  toggleTypewriter,
  toggleFocus,
  reset,
};

export default writingModeStore;
