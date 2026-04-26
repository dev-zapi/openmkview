import { Component, For, Show, createSignal, onCleanup, onMount, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { MobileLayout, mobileLayoutStore } from '../components/mobile';
import FileTree from '../components/FileTree';
import OutlinePanel from '../components/OutlinePanel';
import MainPane from '../components/MainPane';
import { MarkdownHeader } from '../components/markdown-header';
import type { Project, FileContent, Heading, FileNode } from '../types';
import type { Settings, ThemeMode, ThemeType } from '../types/app';
import type { TabType } from '../components/markdown-header';
import styles from '../components/mobile/MobileLayout.module.css';

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
  isSearchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  currentSearchResult: number;
  searchRequestKey: number;
  fileTree: FileNode[];
  onOpenProject: () => void;
  onOpenTrash: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onEditProject: () => void;
  onRefreshProject?: () => void;
  onCloseProject?: () => void;
  onProjectClick: (project: Project) => void | Promise<boolean | void>;
  onFileClick: (path: string, relativePath: string) => void;
  onDelete: (node: FileNode) => void;
  onCopyPath: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
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
  renderProjectIcon: (project: Project) => JSX.Element;
  getProjectStyle: (project: Project) => Record<string, string>;
}

export const MobileLayoutWrapper: Component<MobileLayoutWrapperProps> = (props) => {
  const [topBarMenuOpen, setTopBarMenuOpen] = createSignal(false);

  const handleTopBarMenuOpen = (e: MouseEvent) => {
    e.stopPropagation();
    setTopBarMenuOpen(true);
  };

  const handleTopBarMenuRefresh = () => {
    setTopBarMenuOpen(false);
    props.onRefreshProject?.();
  };

  const handleTopBarMenuEdit = () => {
    setTopBarMenuOpen(false);
    props.onEditProject();
  };

  const handleTopBarMenuCloseProject = () => {
    setTopBarMenuOpen(false);
    props.onCloseProject?.();
  };

  const handleProjectClick = (project: Project) => {
    void props.onProjectClick(project);
  };

  onMount(() => {
    const rootStyle = document.documentElement.style;
    const visualViewport = window.visualViewport;
    let lastViewportHeight = 0;

    const updateViewportHeight = () => {
      const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);

      if (viewportHeight > 0 && viewportHeight !== lastViewportHeight) {
        lastViewportHeight = viewportHeight;
        rootStyle.setProperty('--app-height', `${viewportHeight}px`);
      }
    };

    updateViewportHeight();

    window.addEventListener('resize', updateViewportHeight, { passive: true });
    window.addEventListener('orientationchange', updateViewportHeight);
    visualViewport?.addEventListener('resize', updateViewportHeight);
    visualViewport?.addEventListener('scroll', updateViewportHeight);

    onCleanup(() => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      visualViewport?.removeEventListener('resize', updateViewportHeight);
      visualViewport?.removeEventListener('scroll', updateViewportHeight);
      rootStyle.removeProperty('--app-height');
    });
  });

  return (
    <>
      <MobileLayout
      activeProjectName={props.activeProject?.name}
      leftDrawerCloseOnEscape={true}
      leftDrawerModal={true}
      onProjectMenuOpen={props.activeProject ? handleTopBarMenuOpen : undefined}
      activityBarContent={
        <>
          <div class={styles.activityBarProjects}>
            <For each={props.projects}>
              {(project) => {
                const activeStyle = () => props.getProjectStyle(project);
                const projectColor = () => activeStyle().background;
                const isActive = () => props.activeProject?.id === project.id;

                return (
                <button
                  class={styles.activityBarButton}
                  classList={{
                    [styles.activityBarButtonActive]: isActive(),
                    [styles.activityBarButtonColored]: Boolean(projectColor()) && isActive(),
                    [styles.activityBarButtonHint]: Boolean(projectColor()) && !isActive(),
                  }}
                  title={project.name}
                  aria-label={project.name}
                  onClick={() => handleProjectClick(project)}
                  style={projectColor()
                    ? (isActive()
                        ? activeStyle()
                        : {
                            '--project-color': projectColor(),
                            background: 'transparent',
                          })
                    : undefined}
                >
                  {props.renderProjectIcon(project)}
                </button>
                );
              }}
            </For>

            <button
              class={styles.activityBarButton}
              title="Open Project"
              aria-label="Open Project"
onClick={() => {
                 mobileLayoutStore.closeLeftDrawer();
                 props.onOpenProject();
               }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          <div class={styles.activityBarBottom}>
            <button
              class={styles.activityBarButton}
              classList={{ [styles.activityBarButtonActive]: props.themeMode === 'dark' }}
              title={`Theme: ${props.themeMode} (click to toggle)`}
              aria-label={`Theme: ${props.themeMode}`}
              onClick={props.onToggleTheme}
            >
              <Show when={props.themeMode === 'light'}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </Show>
              <Show when={props.themeMode === 'dark'}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </Show>
              <Show when={props.themeMode === 'system'}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </Show>
            </button>

            <Show when={props.activeProject}>
              <button
                class={styles.activityBarButton}
                title="Trash"
                aria-label="Trash"
onClick={() => {
                 mobileLayoutStore.closeLeftDrawer();
                 props.onOpenTrash();
               }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </Show>

            <button
              class={styles.activityBarButton}
              title="Settings"
              aria-label="Settings"
onClick={() => {
               mobileLayoutStore.closeLeftDrawer();
               props.onOpenSettings();
             }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </>
      }
      sidebarContent={
        <Show when={props.activeProject} fallback={<p class={styles.drawerEmptyState}>Tap the + button above to open a project</p>}>
          <FileTree
            nodes={props.fileTree}
            onFileClick={props.onFileClick}
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
          <Show when={props.imagePreviewUrl && props.currentFileType === 'image'}>
            <MarkdownHeader
              fileName={props.imageFileName}
              activeTab={props.activeTab}
              isOutlineOpen={mobileLayoutStore.rightDrawerOpen}
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
           isSearchOpen={props.isSearchOpen}
           searchQuery={props.searchQuery}
           searchResultCount={props.searchResultCount}
           currentSearchResult={props.currentSearchResult}
           searchRequestKey={props.searchRequestKey}
           diffMode="unified"
           welcomeMessage="Tap the menu button to browse files"
           applyFadeClass={false}
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
          onCloseOutline={() => mobileLayoutStore.closeRightDrawer()}
          showHeader={false}
          showOutline={false}
        />
      </div>
      </MobileLayout>
      <Show when={topBarMenuOpen() && props.activeProject}>
        <Portal>
          <div class={styles.projectMenuOverlay} onClick={() => setTopBarMenuOpen(false)}>
            <div
              class={styles.projectMenuSheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-project-menu-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div class={styles.projectMenuHandle} aria-hidden="true" />
              <div class={styles.projectMenuHeader}>
                <div class={styles.projectMenuHeaderLabel}>Project Actions</div>
                <div class={styles.projectMenuHeaderName} id="mobile-project-menu-title">{props.activeProject!.name}</div>
              </div>
              <button class={styles.projectMenuButton} onClick={handleTopBarMenuRefresh}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>Refresh</span>
              </button>
              <button class={styles.projectMenuButton} onClick={handleTopBarMenuEdit}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Edit Project Info</span>
              </button>
              <button class={styles.projectMenuButton} onClick={handleTopBarMenuCloseProject}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Close Project</span>
              </button>
              <button class={`${styles.projectMenuButton} ${styles.projectMenuCancel}`} onClick={() => setTopBarMenuOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
};

export default MobileLayoutWrapper;
