import { Component, type JSX } from 'solid-js';
import GitPanel from '../components/GitPanel';
import ActivityBar from '../components/ActivityBar';
import SidebarPane from '../components/SidebarPane';
import MainPane from '../components/MainPane';
import type { Project, FileContent, FileType, Heading, FileNode } from '../types';
import type { Settings, ThemeMode, ThemeType } from '../types/app';
import type { TabType } from '../components/markdown-header';

interface DesktopLayoutProps {
  projects: Project[];
  activeProject: Project | null;
  themeMode: ThemeMode;
  currentFile: FileContent | null;
  currentFileType: FileType;
  imagePreviewUrl: string | null;
  imageFileName: string;
  activeTab: TabType;
  outlineOpen: boolean;
  headings: Heading[];
  loading: boolean;
  editContent: string;
  isDirty: boolean;
  saving: boolean;
  settings: Settings;
  theme: ThemeType;
  markdownStyle: Record<string, string>;
  isSearchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  currentSearchResult: number;
  searchRequestKey: number;
  fileTree: FileNode[];
  sidebarWidth: number;
  sidebarTransition: string;
  gitPanelOpen: boolean;
  outlineWidth: number;
  outlineTransition?: string;
  onOutlineStartDragging: () => void;
  onProjectClick: (project: Project) => void;
  onProjectContextMenu: (event: MouseEvent, projectId: number) => void;
  onOpenProject: () => void;
  onToggleTheme: () => void;
  onOpenTrash: () => void;
  onOpenSettings: () => void;
  renderProjectIcon: (project: Project) => JSX.Element;
  getProjectStyle: (project: Project) => Record<string, string>;
  onRefreshProject: () => void;
  onEditProject: () => void;
  onCloseProject: () => void;
  onFileClick: (path: string, relativePath: string) => void;
  onDelete: (node: FileNode) => void;
  onCopyPath: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
  onStartDragging: () => void;
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
  onCloseGitPanel: () => void;
}

export const DesktopLayout: Component<DesktopLayoutProps> = (props) => {
  return (
    <div class="app-container">
      <ActivityBar
        projects={props.projects}
        activeProject={props.activeProject}
        themeMode={props.themeMode}
        onProjectClick={props.onProjectClick}
        onProjectContextMenu={props.onProjectContextMenu}
        onOpenProject={props.onOpenProject}
        onToggleTheme={props.onToggleTheme}
        onOpenTrash={props.onOpenTrash}
        onOpenSettings={props.onOpenSettings}
        renderProjectIcon={props.renderProjectIcon}
        getProjectStyle={props.getProjectStyle}
      />

      <SidebarPane
        project={props.activeProject}
        nodes={props.fileTree}
        sidebarWidth={props.sidebarWidth}
        transition={props.sidebarTransition}
        onRefresh={props.onRefreshProject}
        onEdit={props.onEditProject}
        onCloseProject={props.onCloseProject}
        onFileClick={props.onFileClick}
        onDelete={props.onDelete}
        onCopyPath={props.onCopyPath}
        onRename={props.onRename}
        onStartDragging={props.onStartDragging}
      />

      <MainPane
        currentFile={props.currentFile}
        currentFileType={props.currentFileType}
        imagePreviewUrl={props.imagePreviewUrl}
        imageFileName={props.imageFileName}
        activeTab={props.activeTab}
        isOutlineOpen={props.outlineOpen}
        outlineCount={props.headings.length}
        headings={props.headings}
        loading={props.loading}
        activeProjectId={props.activeProject?.id}
        editContent={props.editContent}
        isDirty={props.isDirty}
        saving={props.saving}
        settings={props.settings}
        theme={props.theme}
        markdownStyle={props.markdownStyle}
        isSearchOpen={props.isSearchOpen}
        searchQuery={props.searchQuery}
        searchResultCount={props.searchResultCount}
        currentSearchResult={props.currentSearchResult}
        searchRequestKey={props.searchRequestKey}
        diffMode="split"
        welcomeMessage={'Click "Open Project" or the + button on the left to start'}
        applyFadeClass={true}
        outlineWidth={props.outlineWidth}
        outlineTransition={props.outlineTransition}
        onOutlineStartDragging={props.onOutlineStartDragging}
        onTabChange={props.onTabChange}
        onOutlineToggle={props.onOutlineToggle}
        onSearchClick={props.onSearchClick}
        onSearchClose={props.onSearchClose}
        onSearchQueryChange={props.onSearchQueryChange}
        onSearchNext={props.onSearchNext}
        onSearchPrev={props.onSearchPrev}
        onSearchResultsChange={props.onSearchResultsChange}
        onHeadingsExtracted={props.onHeadingsExtracted}
        onContentChange={props.onContentChange}
        onSave={props.onSave}
        onCloseDiff={props.onCloseDiff}
        onCloseOutline={props.onCloseOutline}
      />

      <GitPanel
        projectId={props.activeProject?.id || 0}
        isOpen={props.gitPanelOpen}
        onClose={props.onCloseGitPanel}
      />
    </div>
  );
};

export default DesktopLayout;
