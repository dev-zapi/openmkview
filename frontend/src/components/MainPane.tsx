import { Component, Show } from 'solid-js';
import { MarkdownHeader } from './markdown-header';
import { FileContentView } from './FileContentView';
import OutlinePanel from './OutlinePanel';
import type { FileContent, Heading } from '../types';
import type { TabType } from './markdown-header';
import type { Settings, ThemeType } from '../types/app';

interface MainPaneProps {
  currentFile: FileContent | null;
  currentFileType: 'markdown' | 'image';
  imagePreviewUrl: string | null;
  imageFileName: string;
  activeTab: TabType;
  isOutlineOpen: boolean;
  outlineCount: number;
  headings: Heading[];
  loading: boolean;
  activeProjectId?: number;
  editContent: string;
  isDirty: boolean;
  saving: boolean;
  settings: Settings;
  theme: ThemeType;
  markdownStyle: Record<string, string>;
  diffMode: 'split' | 'unified';
  welcomeMessage: string;
  applyFadeClass: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  currentSearchResult: number;
  searchRequestKey: number;
  onTabChange: (tab: TabType) => void;
  onOutlineToggle: () => void;
  onSearchClick: () => void;
  onSearchClose: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  onSearchResultsChange: (count: number) => void;
  onHeadingsExtracted: (headings: Heading[]) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCloseDiff: () => void;
  onCloseOutline: () => void;
  showHeader?: boolean;
  showOutline?: boolean;
}

export const MainPane: Component<MainPaneProps> = (props) => {
  return (
    <main class="main">
      <div class="main-left">
        <Show when={props.showHeader !== false && props.currentFile}>
          <MarkdownHeader
            fileName={props.currentFile!.fileName}
            lastModified={props.currentFile!.lastModified ? new Date(props.currentFile!.lastModified!) : undefined}
            fileSize={props.currentFile!.fileSize}
            activeTab={props.activeTab}
            isOutlineOpen={props.isOutlineOpen}
            outlineCount={props.outlineCount}
            content={props.currentFile!.content}
            fileType={props.currentFileType}
            isSearchOpen={props.isSearchOpen}
            searchQuery={props.searchQuery}
            searchResultCount={props.searchResultCount}
            currentSearchResult={props.currentSearchResult}
            onTabChange={props.onTabChange}
            onOutlineToggle={props.onOutlineToggle}
            onSearchClick={props.onSearchClick}
            onSearchClose={props.onSearchClose}
            onSearchQueryChange={props.onSearchQueryChange}
            onSearchNext={props.onSearchNext}
            onSearchPrev={props.onSearchPrev}
            isDirty={props.isDirty}
            onSave={props.onSave}
            saving={props.saving}
          />
        </Show>

        <Show when={props.showHeader !== false && props.imagePreviewUrl && props.currentFileType === 'image'}>
          <MarkdownHeader
            fileName={props.imageFileName}
            activeTab={props.activeTab}
            isOutlineOpen={props.isOutlineOpen}
            outlineCount={0}
            content=""
            fileType="image"
            isSearchOpen={props.isSearchOpen}
            searchQuery={props.searchQuery}
            searchResultCount={props.searchResultCount}
            currentSearchResult={props.currentSearchResult}
            onTabChange={props.onTabChange}
            onOutlineToggle={props.onOutlineToggle}
            onSearchClick={props.onSearchClick}
            onSearchClose={props.onSearchClose}
            onSearchQueryChange={props.onSearchQueryChange}
            onSearchNext={props.onSearchNext}
            onSearchPrev={props.onSearchPrev}
          />
        </Show>

        <div class="main-content">
          <Show when={props.loading}>
            <div class="loading">Loading...</div>
          </Show>

          <div class="content-area">
            <div class="content-main">
              <FileContentView
                loading={props.loading}
                currentFile={props.currentFile}
                currentFileType={props.currentFileType}
                activeTab={props.activeTab}
                activeProjectId={props.activeProjectId}
                imagePreviewUrl={props.imagePreviewUrl}
                imageFileName={props.imageFileName}
                editContent={props.editContent}
                isDirty={props.isDirty}
                settings={props.settings}
                theme={props.theme}
                markdownStyle={props.markdownStyle}
                diffMode={props.diffMode}
                welcomeMessage={props.welcomeMessage}
                applyFadeClass={props.applyFadeClass}
                searchQuery={props.searchQuery}
                currentSearchResult={props.currentSearchResult}
                searchRequestKey={props.searchRequestKey}
                onSearchResultsChange={props.onSearchResultsChange}
                onHeadingsExtracted={props.onHeadingsExtracted}
                onContentChange={props.onContentChange}
                onSave={props.onSave}
                onCloseDiff={props.onCloseDiff}
              />
            </div>
          </div>
        </div>
      </div>

      <Show when={props.showOutline !== false}>
        <OutlinePanel
          headings={props.headings}
          isOpen={props.isOutlineOpen}
          onClose={props.onCloseOutline}
        />
      </Show>
    </main>
  );
};

export default MainPane;
