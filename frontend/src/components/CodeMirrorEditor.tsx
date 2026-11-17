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
 * Writing Mode typography is settings-driven: applyFontSettings publishes
 * `--writing-font` / `--writing-size` / `--writing-width` on the document root,
 * so a knob change restyles an open editor without rebuilding it. The
 * fallbacks match the pre-settings defaults for the moment before effects run.
 *
 * Created once: CodeMirror's style modules are never pruned, so building a
 * fresh one per toggle would leak dead rules.
 */
const WRITING_THEME = EditorView.theme({
  // CodeMirror theme modules are order-sensitive; the doubled class gives the
  // prose font priority over the code theme's `.cm-content` font rule in both
  // light and dark themes.
  '.cm-content.cm-content': {
    fontFamily: 'var(--writing-font, serif)',
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

  const canWrite = () => props.fileType === 'markdown';

  /**
   * Project-relative paths repeat across projects (`README.md` exists in both
   * project A and project B), so the session key carries the project identity.
   */
  const writingKey = () =>
    `${props.projectId ?? 'unknown'}:${props.filePath || props.fileName || ''}`;

  const isWritingActive = () => canWrite() && writingModeStore.getSession(writingKey()).writing;

  const toggleWriting = () => {
    if (!canWrite()) return;
    writingModeStore.toggleWriting(writingKey());
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
          <span class="save-hint">Ctrl+S to save</span>
        </div>
      </div>
    </div>
  );
};

export default CodeMirrorEditor;
