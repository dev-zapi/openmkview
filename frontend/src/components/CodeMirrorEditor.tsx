import { Component, onMount, onCleanup, createEffect, Show, untrack } from 'solid-js';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { Compartment, EditorState, type Extension, type Range } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { openSearchPanel, searchKeymap } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import type { FileType } from '../types';
import { writingModeStore, writingSessionKey } from '../stores/writingModeStore';
import { resolveEditorThemeExtension } from '../utils/editorThemes';
import './CodeMirrorEditor.css';

/**
 * Writing Mode typography is settings-driven: applyFontSettings publishes
 * `--writing-font` / `--writing-size` / `--writing-width` on the document root,
 * so a knob change restyles an open editor without rebuilding it. The font
 * fallback is the full serif preset (CJK families included), so the frame
 * before settings effects run still renders CJK text coherently.
 *
 * Created once: CodeMirror's style modules are never pruned, so building a
 * fresh one per toggle would leak dead rules.
 */
const WRITING_THEME = EditorView.theme({
  // CodeMirror theme modules are order-sensitive; the doubled class gives the
  // prose font priority over the code theme's `.cm-content` font rule in both
  // light and dark themes.
  '.cm-content.cm-content': {
    fontFamily: 'var(--writing-font, Georgia, "Noto Serif SC", "Songti SC", "Noto Serif", serif)',
    fontSize: 'var(--writing-size, 18px)',
    lineHeight: '1.7',
    maxWidth: 'var(--writing-width, 65ch)',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  '.cm-gutters': {
    display: 'none',
  },
});

/** How far the caret may sit from the viewport middle before we recenter it. */
const TYPEWRITER_CENTER_TOLERANCE_PX = 24;

/**
 * Center the caret's line unless it is already within the middle band.
 * Dispatching an explicit scroll (rather than reserving scroll margins) keeps
 * mouse drag-selection from treating half the viewport as an auto-scroll zone.
 */
const centerCaret = (view: EditorView) => {
  const head = view.state.selection.main.head;

  let caret: { top: number; bottom: number } | null;
  try {
    caret = view.coordsAtPos(head);
  } catch {
    // Layout-less environments (jsdom in unit tests) cannot measure text.
    return;
  }

  if (caret) {
    const viewport = view.scrollDOM.getBoundingClientRect();
    const caretMid = (caret.top + caret.bottom) / 2;
    const viewportMid = (viewport.top + viewport.bottom) / 2;
    if (Math.abs(caretMid - viewportMid) <= TYPEWRITER_CENTER_TOLERANCE_PX) return;
  }

  view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) });
};

/**
 * Typewriter Scrolling: recenter the caret after typing-like edits only.
 * Selection-only changes (mouse drags, clicks, scrolling) and programmatic
 * document swaps are left alone, so they never move the scroll position.
 * The centered scroll is scheduled for the next frame because dispatching
 * during a CodeMirror update is not allowed; it produces no document change,
 * so it cannot loop back into this plugin.
 */
const TYPEWRITER_CENTER = ViewPlugin.fromClass(
  class {
    private frame: number | null = null;
    private destroyed = false;

    update(update: ViewUpdate) {
      if (!update.docChanged) return;

      const typingEdit = update.transactions.some(
        (tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'),
      );
      if (!typingEdit) return;

      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        if (!this.destroyed) centerCaret(update.view);
      });
    }

    destroy() {
      this.destroyed = true;
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  },
);

/** A prose line that is not in the caret's block is dimmed. */
const FOCUS_DIM_LINE = Decoration.line({ class: 'cm-focus-dim' });

/**
 * The caret's block is painted as a rounded highlight card: every line of the
 * block carries the active class, and the block's first/last lines carry the
 * corner classes so CSS can round only the outer corners.
 */
const FOCUS_ACTIVE_LINE = Decoration.line({ class: 'cm-focus-active' });
const FOCUS_ACTIVE_FIRST = Decoration.line({
  class: 'cm-focus-active cm-focus-active-first',
});
const FOCUS_ACTIVE_LAST = Decoration.line({
  class: 'cm-focus-active cm-focus-active-last',
});
const FOCUS_ACTIVE_SOLO = Decoration.line({
  class: 'cm-focus-active cm-focus-active-first cm-focus-active-last',
});

/**
 * Paragraph Focus: the blank-line-delimited block containing the caret keeps
 * full contrast, every other block is dimmed. A block is a maximal run of
 * non-blank lines, so contiguous list lines naturally form one block.
 */
const focusDecorations = (view: EditorView): DecorationSet => {
  const doc = view.state.doc;
  const caretLine = doc.lineAt(view.state.selection.main.head).number;

  const blocks: { from: number; to: number }[] = [];
  let blockStart: number | null = null;
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const blank = doc.line(lineNumber).text.trim().length === 0;
    if (!blank) {
      if (blockStart === null) blockStart = lineNumber;
    } else if (blockStart !== null) {
      blocks.push({ from: blockStart, to: lineNumber - 1 });
      blockStart = null;
    }
  }
  if (blockStart !== null) blocks.push({ from: blockStart, to: doc.lines });

  const activeBlock = blocks.findIndex(
    (block) => caretLine >= block.from && caretLine <= block.to,
  );

  let highlighted = activeBlock;
  if (highlighted === -1) {
    // The caret sits on a blank separator line, which belongs to no block. Keep
    // the nearest block readable rather than dimming the whole document.
    let nearestDistance = Infinity;
    blocks.forEach((block, index) => {
      const distance =
        caretLine < block.from ? block.from - caretLine : caretLine - block.to;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        highlighted = index;
      }
    });
  }

  const ranges: Range<Decoration>[] = [];
  blocks.forEach((block, index) => {
    if (index === highlighted) {
      for (let lineNumber = block.from; lineNumber <= block.to; lineNumber += 1) {
        const isBlockStart = lineNumber === block.from;
        const isBlockEnd = lineNumber === block.to;
        const deco = isBlockStart && isBlockEnd
          ? FOCUS_ACTIVE_SOLO
          : isBlockStart
            ? FOCUS_ACTIVE_FIRST
            : isBlockEnd
              ? FOCUS_ACTIVE_LAST
              : FOCUS_ACTIVE_LINE;
        ranges.push(deco.range(doc.line(lineNumber).from));
      }
      return;
    }
    for (let lineNumber = block.from; lineNumber <= block.to; lineNumber += 1) {
      ranges.push(FOCUS_DIM_LINE.range(doc.line(lineNumber).from));
    }
  });

  return Decoration.set(ranges, true);
};

const PARAGRAPH_FOCUS_EXTENSION = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = focusDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = focusDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

export interface CodeMirrorEditorProps {
  initialContent: string;
  fileName?: string;
  /** Full project-relative path; keys the per-file Writing Mode session. */
  filePath?: string;
  /** Owns the file; the session is per file per project. */
  projectId?: number;
  /** Authoritative file category; only Markdown files offer Writing Mode. */
  fileType?: FileType;
  theme?: 'light' | 'dark';
  /** Edit-mode theme id (see utils/editorThemes); defaults to app/One Dark. */
  editorTheme?: string;
  onSave?: () => void | Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  registerContentGetter?: (getter: () => string) => void;
  isDirty?: boolean;
  searchRequestKey?: number;
}

export const CodeMirrorEditor: Component<CodeMirrorEditorProps> = (props) => {
  let editorContainer: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let editorExtensions: Extension[] = [];
  let lastSearchRequestKey = props.searchRequestKey;
  let previousTypewriterActive = false;
  const writingCompartment = new Compartment();
  const typewriterCompartment = new Compartment();
  const focusCompartment = new Compartment();
  // Theme lives in a compartment so a settings change swaps it live without
  // rebuilding the editor (caret, scroll, and undo history survive).
  const themeCompartment = new Compartment();

  /**
   * Resolve the active theme: a selected preset from utils/editorThemes, or
   * the app-token theme otherwise. Dark falls back to One Dark when nothing
   * is selected, preserving the original hardcoded behavior.
   */
  const buildThemeExtension = (): Extension => {
    const preset = resolveEditorThemeExtension(props.theme ?? 'light', props.editorTheme);
    if (preset) return preset;
    return EditorView.theme({
      '&': {
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-h)',
      },
      '.cm-content': {
        caretColor: 'var(--color-text-h)',
        fontFamily: 'var(--code-font, "JetBrains Mono", ui-monospace, Consolas, monospace)',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--color-text-h)',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'var(--color-active-bg, rgba(48, 96, 144, 0.2))',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--color-bg-subtle)',
        color: 'var(--color-text)',
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--color-hover-bg)',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--color-hover-bg)',
      },
    });
  };

  const canWrite = () => props.fileType === 'markdown';

  /**
   * Project-relative paths repeat across projects (`README.md` exists in both
   * project A and project B), so the session key carries the project identity.
   */
  const writingKey = () =>
    writingSessionKey(props.projectId, props.filePath || props.fileName || '');

  const isWritingActive = () => canWrite() && writingModeStore.getSession(writingKey()).writing;

  const isTypewriterActive = () =>
    isWritingActive() && writingModeStore.getSession(writingKey()).typewriter;

  const isFocusActive = () =>
    isWritingActive() && writingModeStore.getSession(writingKey()).focus;

  const toggleWriting = () => {
    if (!canWrite()) return;
    writingModeStore.toggleWriting(writingKey());
  };

  const toggleTypewriter = () => {
    if (!isWritingActive()) return;
    writingModeStore.toggleTypewriter(writingKey());
  };

  const toggleFocus = () => {
    if (!isWritingActive()) return;
    writingModeStore.toggleFocus(writingKey());
  };

  /** Paragraph dimming; only included while Writing Mode and Focus are on. */
  const focusExtension = () => (isFocusActive() ? PARAGRAPH_FOCUS_EXTENSION : []);

  const getCurrentContent = () => {
    return editorView?.state.doc.toString() || '';
  };

  const checkDirty = () => {
    const current = getCurrentContent();
    const isDirty = current !== props.initialContent;
    props.onDirtyChange?.(isDirty);
  };

  const languageExtension = () => {
    const ext = props.fileName?.split('.').pop()?.toLowerCase();

    if (ext === 'html' || ext === 'htm') {
      return html();
    }

    return markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    });
  };

  const createEditor = (content?: string) => {
    if (!editorContainer) return;

    const saveKeybinding = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          if (props.onSave) {
            props.onSave();
          }
          return true;
        },
      },
      {
        key: 'Mod-Alt-w',
        run: () => {
          if (!canWrite()) return false;
          toggleWriting();
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update: any) => {
      if (update.docChanged) {
        checkDirty();
      }
    });

    const fontExtension = EditorView.theme({
      '.cm-content': {
        fontSize: 'var(--editor-size, var(--code-size, 14px))',
      },
    });

    editorExtensions = [
      basicSetup,
      history(),
      languageExtension(),
      themeCompartment.of(buildThemeExtension()),
      fontExtension,
      writingCompartment.of(isWritingActive() ? WRITING_THEME : []),
      typewriterCompartment.of(isTypewriterActive() ? TYPEWRITER_CENTER : []),
      focusCompartment.of(focusExtension()),
      saveKeybinding,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      updateListener,
      EditorView.lineWrapping,
    ];

    const docContent = content ?? props.initialContent;
    const state = EditorState.create({
      doc: docContent,
      extensions: editorExtensions,
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });
  };

  onMount(() => {
    createEditor();

    if (props.registerContentGetter) {
      props.registerContentGetter(getCurrentContent);
    }
  });

  onCleanup(() => {
    if (editorView) {
      editorView.destroy();
      editorView = undefined;
    }
  });

  createEffect(() => {
    if (!editorView) return;
    const newContent = props.initialContent;

    const currentContent = editorView.state.doc.toString();
    if (currentContent !== newContent) {
      editorView.setState(EditorState.create({
        doc: newContent,
        extensions: editorExtensions,
      }));
    }
  });

  createEffect(() => {
    // This effect must depend on the theme prop alone. createEditor reads the
    // per-file session store, so without untrack a Writing/Focus toggle would
    // re-run it and rebuild the editor, resetting the caret, scroll, and undo
    // history. Store changes flow through the compartment effects below.
    const theme = props.theme;

    untrack(() => {
      if (editorView && theme) {
        const currentContent = getCurrentContent();
        editorView.destroy();
        createEditor(currentContent);
      }
    });
  });

  createEffect(() => {
    if (!editorView) return;

    editorView.dispatch({
      effects: writingCompartment.reconfigure(isWritingActive() ? WRITING_THEME : []),
    });
  });

  createEffect(() => {
    if (!editorView) return;

    const active = isTypewriterActive();

    // Only an inactive -> active transition changes the extension; other
    // session updates (Paragraph Focus, another file) must leave scroll alone.
    if (active === previousTypewriterActive) return;
    previousTypewriterActive = active;

    editorView.dispatch({
      effects: typewriterCompartment.reconfigure(active ? TYPEWRITER_CENTER : []),
    });

    // Entering Typewriter (or Writing Mode with it on) centers immediately
    // rather than waiting for the next keystroke.
    if (active) {
      centerCaret(editorView);
    }
  });

  createEffect(() => {
    if (!editorView) return;

    editorView.dispatch({
      effects: focusCompartment.reconfigure(focusExtension()),
    });
  });

  createEffect(() => {
    if (!editorView) return;
    // Track the theme id so settings changes re-run this effect; the dispatch
    // itself stays untracked to avoid rebuilding the editor for store reads.
    props.editorTheme;
    untrack(() => {
      editorView!.dispatch({
        effects: themeCompartment.reconfigure(buildThemeExtension()),
      });
    });
  });

  createEffect(() => {
    if (!editorView || props.searchRequestKey === undefined || props.searchRequestKey === lastSearchRequestKey) {
      return;
    }

    lastSearchRequestKey = props.searchRequestKey;
    openSearchPanel(editorView);
    editorView.focus();
  });

  return (
    <div
      class="codemirror-editor-container"
      classList={{ 'writing-mode': isWritingActive() }}
      ref={editorContainer}
    >
      <div class="editor-status-bar">
        <div class="status-bar-file">
          <span class="file-name">{props.fileName || 'Untitled'}</span>
          {props.isDirty && <span class="dirty-badge">Modified</span>}
        </div>
        <div class="status-bar-actions">
          <Show when={canWrite()}>
            <button
              type="button"
              class="writing-toggle btn-scale"
              title="Toggle Writing Mode (Ctrl+Alt+W / ⌘+Alt+W)"
              aria-pressed={isWritingActive()}
              onClick={toggleWriting}
            >
              Writing
            </button>
          </Show>
          <Show when={isWritingActive()}>
            <button
              type="button"
              class="writing-toggle btn-scale"
              title="Toggle Typewriter Scrolling"
              aria-pressed={isTypewriterActive()}
              onClick={toggleTypewriter}
            >
              Typewriter
            </button>
            <button
              type="button"
              class="writing-toggle focus-toggle btn-scale"
              title="Toggle Paragraph Focus"
              aria-pressed={isFocusActive()}
              onClick={toggleFocus}
            >
              Focus
            </button>
          </Show>
          <span class="save-hint">Ctrl+S to save</span>
        </div>
      </div>
    </div>
  );
};

export default CodeMirrorEditor;
