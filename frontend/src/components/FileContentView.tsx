import { Component, Show } from 'solid-js';
import MarkdownView from './MarkdownView';
import HtmlPreview from './HtmlPreview';
import SourceView from './SourceView';
import DiffViewer from './DiffViewer';
import DiffSelector from './DiffSelector';
import ImagePreview from './ImagePreview';
import CodeMirrorEditor from './CodeMirrorEditor';
import type { FileContent, FileType, Heading } from '../types';
import type { TabType } from './markdown-header/ViewTabs';
import type { Settings } from '../types/app';
import { Button } from './ui';
import { diffStore } from '../stores/diffStore';
import { fileStore } from '../stores/fileStore';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface FileContentViewProps {
  loading: boolean;
  currentFile: FileContent | null;
  currentFileType: FileType;
  activeTab: TabType;
  activeProjectId: number | undefined;
  imagePreviewUrl: string | null;
  imageFileName: string;
  initialContent: string;
  isDirty: boolean;
  settings: Settings;
  theme: 'light' | 'dark';
  markdownStyle: Record<string, string>;
  diffMode: 'split' | 'unified';
  welcomeMessage?: string;
  /** Heading for the empty state; defaults to the product name. */
  welcomeTitle?: string;
  /** Primary action shown under the empty-state message, e.g. "Open a project". */
  welcomeAction?: { label: string; onClick: () => void };
  applyFadeClass?: boolean;
  searchQuery: string;
  currentSearchResult: number;
  searchRequestKey: number;
  onSearchResultsChange: (count: number) => void;
  onHeadingsExtracted: (headings: Heading[]) => void;
  onDirtyChange: (isDirty: boolean) => void;
  registerContentGetter: (getter: () => string) => void;
  onSave: () => void;
  onCloseDiff: () => void;
  onFileOpen?: (path: string) => void;
}

export const FileContentView: Component<FileContentViewProps> = (props) => {
  const fadeClass = props.applyFadeClass ? 'content-fade-enter' : '';

  return (
    <>
      <Show when={!props.loading && fileStore.loadError()}>
        <div class="empty-state load-error">
          <p>{fileStore.loadError()}</p>
        </div>
      </Show>

      <Show when={!props.loading && props.currentFile?.binary}>
        <div class="binary-placeholder">
          <div class="binary-placeholder-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
          </div>
          <div class="binary-placeholder-name">{props.currentFile!.fileName}</div>
          <div class="binary-placeholder-size">
            {formatFileSize(props.currentFile!.size ?? props.currentFile!.fileSize ?? 0)}
          </div>
          <div class="binary-placeholder-message">Binary file — preview is not available</div>
        </div>
      </Show>

      <Show when={!props.loading && !fileStore.loadError() && !props.currentFile && props.activeTab === 'preview' && props.currentFileType === 'markdown'}>
        <div class="welcome">
          <h1>{props.welcomeTitle || 'OpenMKView'}</h1>
          <Show when={props.welcomeMessage} fallback={<p>Click a file to preview</p>}>
            <p>{props.welcomeMessage}</p>
          </Show>
          <Show when={props.welcomeAction}>
            {(action) => (
              <Button type="button" class="welcome-cta" onClick={action().onClick}>
                {action().label}
              </Button>
            )}
          </Show>
        </div>
      </Show>

      <Show when={!props.loading && props.currentFile && props.activeTab === 'preview' && props.currentFileType === 'markdown'}>
        <div class={`markdown-wrapper ${fadeClass}`} style={props.markdownStyle}>
          <MarkdownView
            content={props.currentFile!.content}
            theme={props.theme}
            onHeadingsExtracted={props.onHeadingsExtracted}
            currentFilePath={props.currentFile!.path}
            projectId={props.activeProjectId}
            searchQuery={props.searchQuery}
            currentSearchResult={props.currentSearchResult}
            onSearchResultsChange={props.onSearchResultsChange}
            onFileOpen={props.onFileOpen}
          />
        </div>
      </Show>

      <Show when={!props.loading && props.currentFile && props.activeTab === 'preview' && props.currentFileType === 'html'}>
        <div class={`html-preview-wrapper ${fadeClass}`}>
          <HtmlPreview
            content={props.currentFile!.content}
            currentFilePath={props.currentFile!.path}
            projectId={props.activeProjectId}
            searchQuery={props.searchQuery}
            currentSearchResult={props.currentSearchResult}
            onSearchResultsChange={props.onSearchResultsChange}
          />
        </div>
      </Show>

      <Show when={!props.loading && props.imagePreviewUrl && props.currentFileType === 'image'}>
        <div class={fadeClass}>
          <ImagePreview
            src={props.imagePreviewUrl!}
            fileName={props.imageFileName}
          />
        </div>
      </Show>

      <Show when={!props.loading && props.activeTab === 'diff' && props.activeProjectId && props.currentFile && props.currentFileType !== 'other' && !props.currentFile.binary}>
        <div class={`diff-wrapper ${fadeClass}`}>
          <DiffSelector
            projectId={props.activeProjectId!}
            filePath={props.currentFile!.path}
          />

          <Show when={diffStore.state.isDiffMode && diffStore.state.diffData}>
            <DiffViewer
              diffData={diffStore.state.diffData!}
              theme={props.theme}
              mode={props.diffMode}
              onClose={props.onCloseDiff}
            />
          </Show>

          <Show when={!diffStore.state.isDiffMode && !diffStore.state.diffData}>
            <div class="diff-empty">
              <p>Select versions to compare</p>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!props.loading && props.currentFile && !props.currentFile.binary && props.activeTab === 'source'}>
        <div class={`source-view ${fadeClass}`}>
          <Show when={props.currentFile!.truncated}>
            <div class="source-notice" role="status">
              File exceeds 1 MB; content is truncated
            </div>
          </Show>
          <Show when={props.currentFile!.lossy}>
            <div class="source-notice" role="status">
              File contains invalid UTF-8 bytes; replacement characters are shown
            </div>
          </Show>
          <SourceView
            content={props.currentFile!.content}
            fileName={props.currentFile!.fileName}
            theme={props.theme}
            searchQuery={props.searchQuery}
            currentSearchResult={props.currentSearchResult}
            onSearchResultsChange={props.onSearchResultsChange}
          />
        </div>
      </Show>

      <Show when={!props.loading && props.currentFile && props.activeTab === 'edit' && props.currentFileType !== 'other' && !props.currentFile.binary}>
        <div class={`edit-view ${fadeClass}`}>
          <CodeMirrorEditor
            initialContent={props.initialContent}
            fileName={props.currentFile!.fileName}
            filePath={props.currentFile!.path}
            projectId={props.activeProjectId}
            fileType={props.currentFileType}
            theme={props.theme}
            editorTheme={
              props.theme === 'dark' ? props.settings.editorThemeDark : props.settings.editorThemeLight
            }
            onSave={props.onSave}
            onDirtyChange={props.onDirtyChange}
            registerContentGetter={props.registerContentGetter}
            isDirty={props.isDirty}
            searchRequestKey={props.searchRequestKey}
          />
        </div>
      </Show>
    </>
  );
};
