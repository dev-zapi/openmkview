import { Component, For, Show, type JSX } from 'solid-js';
import { MobileLayout, mobileLayoutStore } from '../components/mobile';
import FileTree from '../components/FileTree';
import OutlinePanel from '../components/OutlinePanel';
import MainPane from '../components/MainPane';
import { MarkdownHeader } from '../components/markdown-header';
import type { Project, FileContent, Heading, FileNode } from '../types';
import type { Settings, ThemeMode, ThemeType } from '../types/app';
import type { TabType } from '../components/markdown-header';

interface MobileLayoutWrapperProps {
  projects: Project[];
  activeProject: Project | null;
  currentFile: FileContent | null;
  currentFileType: 'markdown' | 'image';
  imagePreviewUrl: string | null;
  imageFileName: string;
  activeTab: TabType;
  headings: Heading[];
  loading: boolean;
  editContent: string;
  isDirty: boolean;
  saving: boolean;
  settings: Settings;
  theme: ThemeType;
  themeMode: ThemeMode;
  markdownStyle: Record<string, string>;
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  onOpenProject: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onEditProject: () => void;
  onOpenProjectColorChange: (event: MouseEvent) => void;
  onProjectClick: (project: Project) => void;
  onFileClick: (path: string, relativePath: string) => void;
  onFolderToggle: (path: string, expanded: boolean) => void;
  onDelete: (node: FileNode) => void;
  onCopyPath: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
  onTabChange: (tab: TabType) => void;
  onOutlineToggle: () => void;
  onHeadingsExtracted: (headings: Heading[]) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCloseDiff: () => void;
  renderProjectIcon: (project: Project) => JSX.Element;
  getProjectStyle: (project: Project) => Record<string, string>;
}

export const MobileLayoutWrapper: Component<MobileLayoutWrapperProps> = (props) => {
  return (
    <MobileLayout
      activeProjectName={props.activeProject?.name}
      onSettingsClick={props.onOpenSettings}
      onThemeToggle={props.onToggleTheme}
      currentTheme={props.themeMode}
      onProjectEdit={props.onEditProject}
      onProjectColorChange={props.onOpenProjectColorChange}
      activityBarContent={
        <>
          <For each={props.projects}>
            {(project) => (
              <button
                class={props.activeProject?.id === project.id ? 'active' : ''}
                title={project.name}
                onClick={() => props.onProjectClick(project)}
                style={props.getProjectStyle(project)}
              >
                {props.renderProjectIcon(project)}
                <span class="mobile-project-name">{project.name}</span>
              </button>
            )}
          </For>
          <button
            class="activity-bar-add"
            title="Open Project"
            onClick={() => {
              mobileLayoutStore.closeLeftDrawer();
              props.onOpenProject();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span class="mobile-project-name">Open Project</span>
          </button>
        </>
      }
      sidebarContent={
        <Show when={props.activeProject} fallback={<p class="empty-state">Tap the + button above to open a project</p>}>
          <FileTree
            nodes={props.fileTree}
            onFileClick={props.onFileClick}
            expandedFolders={props.expandedFolders}
            onFolderToggle={props.onFolderToggle}
            onDelete={props.onDelete}
            onCopyPath={props.onCopyPath}
            onRename={props.onRename}
          />
        </Show>
      }
      outlinePanelContent={
        <OutlinePanel
          headings={props.headings}
          isOpen={mobileLayoutStore.rightDrawerOpen}
          onClose={() => mobileLayoutStore.closeRightDrawer()}
          showCloseButton={true}
          onHeadingClick={() => mobileLayoutStore.closeRightDrawer()}
        />
      }
      headerContent={
        <>
          <Show when={props.currentFile}>
            <MarkdownHeader
              fileName={props.currentFile!.fileName}
              lastModified={props.currentFile!.lastModified ? new Date(props.currentFile!.lastModified!) : undefined}
              fileSize={props.currentFile!.fileSize}
              activeTab={props.activeTab}
              isOutlineOpen={mobileLayoutStore.rightDrawerOpen}
              outlineCount={props.headings.length}
              content={props.currentFile!.content}
              fileType={props.currentFileType}
              onTabChange={props.onTabChange}
              onOutlineToggle={props.onOutlineToggle}
              isDirty={props.isDirty}
              onSave={props.onSave}
              saving={props.saving}
            />
          </Show>
          <Show when={props.imagePreviewUrl && props.currentFileType === 'image'}>
            <MarkdownHeader
              fileName={props.imageFileName}
              activeTab={props.activeTab}
              isOutlineOpen={mobileLayoutStore.rightDrawerOpen}
              outlineCount={0}
              content=""
              fileType="image"
              onTabChange={props.onTabChange}
              onOutlineToggle={props.onOutlineToggle}
            />
          </Show>
        </>
      }
    >
      <div class="mobile-main-content">
        <MainPane
          currentFile={props.currentFile}
          currentFileType={props.currentFileType}
          imagePreviewUrl={props.imagePreviewUrl}
          imageFileName={props.imageFileName}
          activeTab={props.activeTab}
          isOutlineOpen={mobileLayoutStore.rightDrawerOpen}
          outlineCount={props.headings.length}
          headings={[]}
          loading={props.loading}
          activeProjectId={props.activeProject?.id}
          editContent={props.editContent}
          isDirty={props.isDirty}
          saving={props.saving}
          settings={props.settings}
          theme={props.theme}
          markdownStyle={props.markdownStyle}
          diffMode="unified"
          welcomeMessage="Tap the menu button to browse files"
          applyFadeClass={false}
          onTabChange={props.onTabChange}
          onOutlineToggle={props.onOutlineToggle}
          onHeadingsExtracted={props.onHeadingsExtracted}
          onContentChange={props.onContentChange}
          onSave={props.onSave}
          onCloseDiff={props.onCloseDiff}
          onCloseOutline={() => mobileLayoutStore.closeRightDrawer()}
          showHeader={false}
          showOutline={false}
        />
      </div>
    </MobileLayout>
  );
};

export default MobileLayoutWrapper;
