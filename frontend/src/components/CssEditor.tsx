import { Component, onMount, onCleanup, createEffect, on } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';

export interface CssEditorProps {
  value: string;
  onChange: (v: string) => void;
  theme?: 'light' | 'dark';
}

export const CssEditor: Component<CssEditorProps> = (props) => {
  let editorContainer: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let editorExtensions: Extension[] = [];
  let suppressChange = false;

  const buildExtensions = (): Extension[] => {
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

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !suppressChange) {
        props.onChange(update.state.doc.toString());
      }
    });

    return [
      basicSetup,
      css(),
      themeExtension,
      updateListener,
      EditorView.lineWrapping,
    ];
  };

  const createEditor = (content: string) => {
    if (!editorContainer) return;

    editorExtensions = buildExtensions();
    const state = EditorState.create({
      doc: content,
      extensions: editorExtensions,
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });
  };

  onMount(() => {
    createEditor(props.value);
  });

  onCleanup(() => {
    if (editorView) {
      editorView.destroy();
      editorView = undefined;
    }
  });

  // Reflect external value changes
  createEffect(() => {
    if (!editorView) return;
    const newValue = props.value;
    const current = editorView.state.doc.toString();
    if (current !== newValue) {
      suppressChange = true;
      editorView.setState(EditorState.create({
        doc: newValue,
        extensions: editorExtensions,
      }));
      suppressChange = false;
    }
  });

  // Rebuild on theme change (deferred to skip initial mount)
  createEffect(on(() => props.theme, () => {
    if (!editorView) return;
    const current = editorView.state.doc.toString();
    editorView.destroy();
    editorView = undefined;
    createEditor(current);
  }, { defer: true }));

  return (
    <div class="css-editor-container" ref={editorContainer} />
  );
};

export default CssEditor;
