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
import { diffStore } from '../stores/diffStore';

export interface FileContentViewProps {
  loading: boolean;
  currentFile: FileContent | null;
  currentFileType: FileType;
  activeTab: TabType;
  activeProjectId: number | undefined;
  imagePreviewUrl: string | null;
  imageFileName: string;
  editContent: string;
  isDirty: boolean;
  settings: Settings;
  theme: 'light' | 'dark';
  markdownStyle: Record<string, string>;
  diffMode: 'split' | 'unified';
  welcomeMessage?: string;
  applyFadeClass?: boolean;
  searchQuery: string;
  currentSearchResult: number;
  searchRequestKey: number;
  onSearchResultsChange: (count: number) => void;
  onHeadingsExtracted: (headings: Heading[]) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCloseDiff: () => void;
}

export const FileContentView: Component<FileContentViewProps> = (props) => {
  const fadeClass = props.applyFadeClass ? 'content-fade-enter' : '';

  return (
    <>
      <Show when={props.loading}>
        <div class="loading">Loading...</div>
      </Show>

      <Show when={!props.loading && !props.currentFile && props.activeTab === 'preview' && props.currentFileType === 'markdown'}>
        <div class="welcome">
          <h1>OpenMKView</h1>
          <Show when={props.welcomeMessage} fallback={<p>Click a file to preview</p>}>
            <p>{props.welcomeMessage}</p>
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

      <Show when={!props.loading && props.activeTab === 'diff' && props.activeProjectId && props.currentFile}>
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

      <Show when={!props.loading && props.currentFile && props.activeTab === 'source'}>
        <div class={`source-view ${fadeClass}`}>
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

      <Show when={!props.loading && props.currentFile && props.activeTab === 'edit'}>
        <div class={`edit-view ${fadeClass}`}>
          <CodeMirrorEditor
            content={props.editContent}
            fileName={props.currentFile!.fileName}
            theme={props.theme}
            onContentChange={props.onContentChange}
            onSave={props.onSave}
            isDirty={props.isDirty}
            searchRequestKey={props.searchRequestKey}
          />
        </div>
      </Show>
    </>
  );
};
