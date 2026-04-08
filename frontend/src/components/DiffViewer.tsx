import { Component, createSignal, createEffect, onCleanup } from 'solid-js';
import { FileDiff, type FileDiffOptions, type FileContents } from '@pierre/diffs';
import type { GitDiff } from '../types';

interface DiffViewerProps {
  diffData: GitDiff;
  theme?: 'light' | 'dark';
  mode?: 'split' | 'unified';
  language?: string;
  onClose?: () => void;
}

const DiffViewer: Component<DiffViewerProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [viewMode, setViewMode] = createSignal<'split' | 'unified'>(
    props.mode || 'split'
  );
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let fileDiffInstance: FileDiff | null = null;

  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      css: 'css',
      scss: 'scss',
      html: 'html',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
      sh: 'bash',
    };
    return langMap[ext] || 'text';
  };

  const renderDiff = async () => {
    if (!containerRef || !props.diffData) return;

    setIsLoading(true);
    setError(null);

    containerRef.innerHTML = '';

    try {
      if (fileDiffInstance) {
        fileDiffInstance.cleanUp();
        fileDiffInstance = null;
      }

      const lang = props.language || getLanguageFromFileName(props.diffData.newFileName || 'text');

      const oldFile: FileContents = {
        name: props.diffData.oldFileName || 'old',
        contents: props.diffData.oldContent || '',
      };

      const newFile: FileContents = {
        name: props.diffData.newFileName || 'new',
        contents: props.diffData.newContent || '',
      };

      const options: FileDiffOptions<undefined> = {
        themeType: props.theme === 'dark' ? 'dark' : 'light',
        diffStyle: viewMode(),
        diffIndicators: 'bars',
        disableLineNumbers: false,
        disableFileHeader: false,
      };

      fileDiffInstance = new FileDiff<undefined>(options);

      const fileContainer = document.createElement('div');
      fileContainer.className = 'pierre-diff-container';
      containerRef.appendChild(fileContainer);

      fileDiffInstance.render({
        oldFile,
        newFile,
        fileContainer,
      });

    } catch (err) {
      console.error('Failed to render diff:', err);
      setError(String(err));
      renderFallbackDiff();
    } finally {
      setIsLoading(false);
    }
  };

  const renderFallbackDiff = () => {
    if (!containerRef || !props.diffData) return;

    const data = props.diffData;
    let diff = `diff --git a/${data.oldFileName} b/${data.newFileName}\n`;
    diff += `--- a/${data.oldFileName}\n`;
    diff += `+++ b/${data.newFileName}\n`;

    data.hunks.forEach((hunk) => {
      diff += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
      hunk.lines.forEach((line) => {
        const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
        diff += `${prefix}${line.content}\n`;
      });
    });

    const pre = document.createElement('pre');
    pre.className = `diff-fallback diff-view ${props.theme || 'light'}`;
    pre.textContent = diff;
    containerRef.appendChild(pre);
  };

  const toggleMode = () => {
    setViewMode((v) => (v === 'split' ? 'unified' : 'split'));
  };

  createEffect(() => {
    props.diffData;
    props.theme;
    viewMode();
    renderDiff();
  });

  onCleanup(() => {
    if (fileDiffInstance) {
      fileDiffInstance.cleanUp();
      fileDiffInstance = null;
    }
    if (containerRef) {
      containerRef.innerHTML = '';
    }
  });

  return (
    <div class="diff-viewer">
      <div class="diff-toolbar">
        <div class="diff-toolbar-left">
          <button class="toolbar-btn" onClick={toggleMode} title="Toggle view mode">
            {viewMode() === 'split' ? 'Unified View' : 'Split View'}
          </button>
          <span class="diff-file-info">
            {props.diffData.oldFileName} → {props.diffData.newFileName}
          </span>
        </div>
        <div class="diff-toolbar-right">
          {props.onClose && (
            <button class="toolbar-btn close-btn" onClick={props.onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      <div class="diff-content">
        {isLoading() && (
          <div class="diff-loading">
            <div class="loading-spinner"></div>
            <span>Loading diff...</span>
          </div>
        )}

        {error() && (
          <div class="diff-error">
            <span>Error: {error()}</span>
            <span class="diff-fallback-note">Showing plain diff</span>
          </div>
        )}

        <div
          ref={containerRef}
          class="diff-container"
          classList={{
            'diff-loading-active': isLoading(),
          }}
        />
      </div>
    </div>
  );
};

export default DiffViewer;