import { Component, onMount, onCleanup, createEffect, Show } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { openSearchPanel, searchKeymap } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import type { FileType } from '../types';
import { writingModeStore } from '../stores/writingModeStore';
import './CodeMirrorEditor.css';

/**
 * Writing Mode typography defaults. Hardcoded for the first release (ticket
 * #9); ticket #10 replaces these with settings-driven values, so keep them
 * together behind one resolver rather than inlining them in the extension.
 */
export const WRITING_FONT_FAMILY = 'Georgia, "Noto Serif SC", "Songti SC", "Noto Serif", serif';
export const WRITING_FONT_SIZE = '18px';
export const WRITING_COLUMN_WIDTH = '65ch';

/**
 * Centered prose column, only mounted while Writing Mode is active. Created
 * once: CodeMirror's style modules are never pruned, so building a fresh one
 * per toggle would leak dead rules.
 */
const WRITING_THEME = EditorView.theme({
  // CodeMirror theme modules are order-sensitive; the doubled class gives the
  // prose font priority over the code theme's `.cm-content` font rule in both
  // light and dark themes.
  '.cm-content.cm-content': {
    fontFamily: WRITING_FONT_FAMILY,
    fontSize: WRITING_FONT_SIZE,
    lineHeight: '1.7',
    maxWidth: WRITING_COLUMN_WIDTH,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  '.cm-gutters': {
    display: 'none',
  },
});

/**
 * Typewriter Scrolling: CodeMirror treats scroll margins as extra space that
 * must stay visible around the caret. Giving it half a viewport on each side
 * shrinks the "visible" band to the middle line, so the built-in minimal
 * scroll-into-view pins the caret's line at the vertical center while typing.
 * It never scrolls by itself, so manual scrolling is left alone.
 */
const TYPEWRITER_SCROLL = EditorView.scrollMargins.of((view) => {
  const halfViewport = view.scrollDOM.clientHeight / 2;
  return { top: halfViewport, bottom: halfViewport };
});

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
  const writingCompartment = new Compartment();
  const typewriterCompartment = new Compartment();

  const canWrite = () => props.fileType === 'markdown';

  /**
   * Project-relative paths repeat across projects (`README.md` exists in both
   * project A and project B), so the session key carries the project identity.
   */
  const writingKey = () =>
    `${props.projectId ?? 'unknown'}:${props.filePath || props.fileName || ''}`;

  const isWritingActive = () => canWrite() && writingModeStore.getSession(writingKey()).writing;

  const isTypewriterActive = () => isWritingActive() && writingModeStore.getSession(writingKey()).typewriter;

  const toggleWriting = () => {
    if (!canWrite()) return;
    writingModeStore.toggleWriting(writingKey());
  };

  const toggleTypewriter = () => {
    if (!isWritingActive()) return;
    writingModeStore.toggleTypewriter(writingKey());
  };

  /** Centered prose column; only included while Writing Mode is active. */
  const writingExtension = () => WRITING_THEME;

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
        run: (view: EditorView) => {
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

    const themeExtension = props.theme === 'dark' ? oneDark : EditorView.theme({
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

    editorExtensions = [
      basicSetup,
      history(),
      languageExtension(),
      themeExtension,
      fontExtension,
      writingCompartment.of(isWritingActive() ? writingExtension() : []),
      typewriterCompartment.of(isTypewriterActive() ? TYPEWRITER_SCROLL : []),
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
    if (editorView && props.theme) {
      const currentContent = getCurrentContent();
      editorView.destroy();
      createEditor(currentContent);
    }
  });

  createEffect(() => {
    if (!editorView) return;

    editorView.dispatch({
      effects: writingCompartment.reconfigure(isWritingActive() ? writingExtension() : []),
    });
  });

  createEffect(() => {
    if (!editorView) return;

    editorView.dispatch({
      effects: typewriterCompartment.reconfigure(isTypewriterActive() ? TYPEWRITER_SCROLL : []),
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
              class="writing-toggle"
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
              class="writing-toggle"
              title="Toggle Typewriter Scrolling"
              aria-pressed={isTypewriterActive()}
              onClick={toggleTypewriter}
            >
              Typewriter
            </button>
          </Show>
          <span class="save-hint">Ctrl+S to save</span>
        </div>
      </div>
    </div>
  );
};

export default CodeMirrorEditor;
