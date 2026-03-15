import { Component, createSignal, Show } from 'solid-js';
import type { GitDiff } from '../types';

interface DiffViewerProps {
  diffData: GitDiff;
  theme?: 'light' | 'dark';
  mode?: 'split' | 'unified';
  language?: string;
  onClose?: () => void;
}

const DiffViewer: Component<DiffViewerProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'split' | 'unified'>(
    props.mode || 'split'
  );
  const [highlight, setHighlight] = createSignal(true);
  const [theme, setTheme] = createSignal<'light' | 'dark'>(props.theme || 'light');

  const generateUnifiedDiff = () => {
    const data = props.diffData;
    if (!data) return '';

    let diff = `diff --git a/${data.oldFileName} b/${data.newFileName}\n`;
    diff += `--- a/${data.oldFileName}\n`;
    diff += `+++ b/${data.newFileName}\n`;

    data.hunks.forEach((hunk) => {
      diff += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
      hunk.lines.forEach((line) => {
        const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
        const className = line.type === 'add' ? 'diff-add' : line.type === 'remove' ? 'diff-remove' : '';
        diff += `<span class="${className}">${prefix}${escapeHtml(line.content)}</span>\n`;
      });
    });

    return diff;
  };

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const toggleMode = () => {
    setViewMode((v) => (v === 'split' ? 'unified' : 'split'));
  };

  const toggleHighlight = () => {
    setHighlight((h) => !h);
  };

  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  return (
    <div class="diff-viewer">
      <div class="diff-toolbar">
        <div class="diff-toolbar-left">
          <button class="toolbar-btn" onClick={toggleMode} title="Toggle view mode">
            {viewMode() === 'split' ? 'Combined View' : 'Split View'}
          </button>
          <button class="toolbar-btn" onClick={toggleHighlight} title="Syntax highlight">
            {highlight() ? 'Highlight On' : 'Highlight Off'}
          </button>
        </div>
        <div class="diff-toolbar-right">
          <button class="toolbar-btn" onClick={toggleTheme} title="Toggle theme">
            {theme() === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <Show when={props.onClose}>
            <button class="toolbar-btn close-btn" onClick={props.onClose}>
              Close
            </button>
          </Show>
        </div>
      </div>

      <div class="diff-content">
        <pre class={`diff-view ${theme()}`}>
          <code innerHTML={generateUnifiedDiff()} />
        </pre>
      </div>
    </div>
  );
};

export default DiffViewer;
