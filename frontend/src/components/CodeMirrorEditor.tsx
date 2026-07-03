import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { openSearchPanel, searchKeymap } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import './CodeMirrorEditor.css';

export interface CodeMirrorEditorProps {
  initialContent: string;
  fileName?: string;
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
    ]);

    const updateListener = EditorView.updateListener.of((update: any) => {
      if (update.docChanged) {
        checkDirty();
      }
    });

    const themeExtension = props.theme === 'dark' ? oneDark : EditorView.theme({
      '&': {
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-h)',
      },
      '.cm-content': {
        caretColor: 'var(--color-text-h)',
        fontFamily: 'var(--code-font, "JetBrains Mono", ui-monospace, Consolas, monospace)',
        fontSize: 'var(--code-size, 14px)',
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
    if (!editorView || props.searchRequestKey === undefined || props.searchRequestKey === lastSearchRequestKey) {
      return;
    }

    lastSearchRequestKey = props.searchRequestKey;
    openSearchPanel(editorView);
    editorView.focus();
  });

  return (
    <div class="codemirror-editor-container" ref={editorContainer}>
      <div class="editor-status-bar">
        <span class="file-name">{props.fileName || 'Untitled'}</span>
        {props.isDirty && <span class="dirty-badge">Modified</span>}
        <span class="save-hint">Ctrl+S to save</span>
      </div>
    </div>
  );
};

export default CodeMirrorEditor;
