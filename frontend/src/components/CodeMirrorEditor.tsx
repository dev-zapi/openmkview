import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import './CodeMirrorEditor.css';

export interface CodeMirrorEditorProps {
  content: string;
  fileName?: string;
  theme?: 'light' | 'dark';
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  isDirty?: boolean;
}

export const CodeMirrorEditor: Component<CodeMirrorEditorProps> = (props) => {
  let editorContainer: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let lastContent: string = props.content;

  const createEditor = () => {
    if (!editorContainer) return;

    const saveKeybinding = keymap.of([
      {
        key: 'Mod-s',
        run: (view: EditorView) => {
          if (props.onSave) {
            const content = view.state.doc.toString();
            props.onSave(content);
          }
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update: any) => {
      if (update.docChanged && props.onContentChange) {
        const newContent = update.state.doc.toString();
        props.onContentChange(newContent);
      }
    });

    const themeExtension = props.theme === 'dark' ? oneDark : EditorView.theme({
      '&': {
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-h)',
      },
      '.cm-content': {
        caretColor: 'var(--color-text-h)',
        fontFamily: 'var(--markdown-font, Georgia, "Noto Serif", serif)',
        fontSize: 'var(--markdown-size, 16px)',
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

    const extensions = [
      basicSetup,
      history(),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      themeExtension,
      saveKeybinding,
      updateListener,
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: props.content,
      extensions,
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });
  };

  const updateContent = (newContent: string) => {
    if (!editorView || newContent === lastContent) return;

    const currentContent = editorView.state.doc.toString();
    if (currentContent === newContent) return;

    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: newContent,
      },
    });
    lastContent = newContent;
  };

  onMount(() => {
    createEditor();
  });

  onCleanup(() => {
    if (editorView) {
      editorView.destroy();
      editorView = undefined;
    }
  });

  createEffect(() => {
    if (props.content && editorView) {
      updateContent(props.content);
    }
  });

  createEffect(() => {
    if (editorView && props.theme) {
      editorView.destroy();
      createEditor();
    }
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