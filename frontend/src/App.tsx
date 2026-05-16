import { Component, createEffect, createSignal, createMemo } from 'solid-js';
import { DesktopLayout, MobileLayoutWrapper } from './layouts';
import { GlobalDialogs } from './components/GlobalDialogs';
import { useProject, useFile, useEditor, useLayout, useLifecycle } from './hooks';
import { projectStore } from './stores/projectStore';
import { fileStore } from './stores/fileStore';
import { editorStore } from './stores/editorStore';
import { appStore } from './stores/appStore';
import { settingsStore } from './stores/settingsStore';
import type { Project } from './types';
import { mobileLayoutStore } from './components/mobile';
import { getMarkdownStyle } from './utils/settings';
import './styles/global.css';
import './components/ColorPicker.css';
import './components/ProjectEditDialog.css';

const App: Component = () => {
  const projectHook = useProject();
  const fileHook = useFile();
  const editorHook = useEditor();
  const layoutHook = useLayout();
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResultCount, setSearchResultCount] = createSignal(0);
  const [currentSearchResult, setCurrentSearchResult] = createSignal(0);
  const [editorSearchRequestKey, setEditorSearchRequestKey] = createSignal(0);
  const [searchScopeKey, setSearchScopeKey] = createSignal('');

  const isDocumentFile = () => {
    const fileType = fileStore.currentFileType();
    return fileType === 'markdown' || fileType === 'html';
  };

  useLifecycle();

  createEffect(() => {
    const fileType = fileStore.currentFileType();
    const activeTab = appStore.activeTab();
    const currentFilePath = fileStore.currentFile()?.path || '';
    const nextScopeKey = `${currentFilePath}:${activeTab}`;

    if (nextScopeKey !== searchScopeKey()) {
      setSearchScopeKey(nextScopeKey);
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchResultCount(0);
      setCurrentSearchResult(0);
    }

    if ((fileType !== 'markdown' && fileType !== 'html') || activeTab === 'edit' || activeTab === 'diff') {
      setIsSearchOpen(false);
    }

    if ((fileType !== 'markdown' && fileType !== 'html') || activeTab === 'diff') {
      setSearchQuery('');
      setSearchResultCount(0);
      setCurrentSearchResult(0);
    }
  });

  const renderProjectIcon = (project: Project) => {
    const icon = projectHook.renderProjectIconContent(project);
    if (icon.type === 'image') {
      return <img src={icon.src} alt="favicon" class="project-favicon" />;
    }
    return <span class="project-initial">{icon.text}</span>;
  };

  const handleProjectClose = () => {
    const project = projectStore.state.activeProject;
    if (project) {
      void projectHook.closeProject(project.id);
    }
  };

  const handleMobileProjectClick = async (project: Project) => {
    return projectHook.switchProject(project);
  };

  const theme = settingsStore.effectiveTheme;
  const markdownStyle = createMemo(() => getMarkdownStyle(settingsStore.settings()));

  const handleSearchClick = () => {
    if (!isDocumentFile()) {
      return;
    }

    if (appStore.activeTab() === 'diff') {
      return;
    }

    if (appStore.activeTab() === 'edit') {
      setEditorSearchRequestKey((key) => key + 1);
      return;
    }

    setIsSearchOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResultCount(0);
    setCurrentSearchResult(0);
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setCurrentSearchResult(query.trim() ? 1 : 0);
  };

  const handleSearchResultsChange = (count: number) => {
    setSearchResultCount(count);
    setCurrentSearchResult((current) => {
      if (count === 0) return 0;
      if (current < 1) return 1;
      return Math.min(current, count);
    });
  };

  const handleSearchNext = () => {
    const count = searchResultCount();
    if (count === 0) return;
    setCurrentSearchResult((current) => (current >= count || current < 1 ? 1 : current + 1));
  };

  const handleSearchPrev = () => {
    const count = searchResultCount();
    if (count === 0) return;
    setCurrentSearchResult((current) => (current <= 1 ? count : current - 1));
  };

  return (
    <>
      {appStore.isMobile() ? (
        <MobileLayoutWrapper
          projects={projectStore.state.projects}
          activeProject={projectStore.state.activeProject}
          currentFile={fileStore.currentFile()}
          currentFileType={fileStore.currentFileType()}
          imagePreviewUrl={fileStore.imagePreviewUrl()}
          imageFileName={fileStore.imageFileName()}
          activeTab={appStore.activeTab()}
          headings={fileStore.extractedHeadings()}
          loading={fileStore.loading()}
          editContent={editorStore.editContent()}
          isDirty={editorStore.isDirty()}
          saving={editorStore.saving()}
          settings={settingsStore.settings()}
          theme={theme}
          themeMode={settingsStore.settings().themeMode}
          markdownStyle={markdownStyle()}
          isSearchOpen={isSearchOpen()}
          searchQuery={searchQuery()}
          searchResultCount={searchResultCount()}
          currentSearchResult={currentSearchResult()}
          searchRequestKey={editorSearchRequestKey()}
          fileTree={fileStore.fileTree()}
          onOpenProject={projectHook.openProject}
          onOpenTrash={() => appStore.openTrashDialog()}
          onOpenSettings={() => appStore.setSettingsOpen(true)}
          onToggleTheme={() => settingsStore.toggleThemeMode()}
          onEditProject={() => appStore.openProjectEditDialog()}
          onRefreshProject={() => void projectHook.refreshProject()}
onCloseProject={handleProjectClose}
           onProjectClick={handleMobileProjectClick}
           onFileClick={(path) => fileHook.mobileFileClick(path)}
          onDelete={(node) => void fileHook.deleteFile(node)}
          onCopyPath={(node) => void fileHook.copyPath(node)}
          onRename={fileHook.renameFile}
          onTabChange={editorHook.changeTab}
          onOutlineToggle={layoutHook.handleMobileOutlineToggle}
          onSearchClick={handleSearchClick}
          onSearchClose={handleSearchClose}
          onSearchQueryChange={handleSearchQueryChange}
          onSearchNext={handleSearchNext}
          onSearchPrev={handleSearchPrev}
          onSearchResultsChange={handleSearchResultsChange}
          onHeadingsExtracted={editorHook.handleHeadingsExtracted}
          onContentChange={editorHook.handleContentChange}
          onSave={() => void editorHook.saveFile()}
          onCloseDiff={fileHook.closeDiff}
          renderProjectIcon={renderProjectIcon}
          getProjectStyle={projectHook.getColorStyle}
        />
      ) : (
        <DesktopLayout
          projects={projectStore.state.projects}
          activeProject={projectStore.state.activeProject}
          themeMode={settingsStore.settings().themeMode}
          currentFile={fileStore.currentFile()}
          currentFileType={fileStore.currentFileType()}
          imagePreviewUrl={fileStore.imagePreviewUrl()}
          imageFileName={fileStore.imageFileName()}
          activeTab={appStore.activeTab()}
          outlineOpen={appStore.outlineOpen()}
          headings={fileStore.extractedHeadings()}
          loading={fileStore.loading()}
          editContent={editorStore.editContent()}
          isDirty={editorStore.isDirty()}
          saving={editorStore.saving()}
          settings={settingsStore.settings()}
          theme={theme}
          markdownStyle={markdownStyle()}
          isSearchOpen={isSearchOpen()}
          searchQuery={searchQuery()}
          searchResultCount={searchResultCount()}
          currentSearchResult={currentSearchResult()}
          searchRequestKey={editorSearchRequestKey()}
          fileTree={fileStore.fileTree()}
          sidebarWidth={appStore.sidebarWidth()}
          sidebarTransition={layoutHook.getSidebarTransitionStyle()}
          gitPanelOpen={appStore.gitPanelOpen()}
          onProjectClick={(project) => void projectHook.switchProject(project)}
          onProjectContextMenu={projectHook.openColorPicker}
          onOpenProject={projectHook.openProject}
          onToggleTheme={() => settingsStore.toggleThemeMode()}
          onOpenTrash={() => appStore.openTrashDialog()}
          onOpenSettings={() => appStore.setSettingsOpen(true)}
          renderProjectIcon={renderProjectIcon}
          getProjectStyle={projectHook.getColorStyle}
          onRefreshProject={() => void projectHook.refreshProject()}
          onEditProject={() => appStore.openProjectEditDialog()}
          onCloseProject={handleProjectClose}
          onFileClick={(path) => void fileHook.openFile(path)}
          onDelete={(node) => void fileHook.deleteFile(node)}
          onCopyPath={(node) => void fileHook.copyPath(node)}
          onRename={fileHook.renameFile}
          onStartDragging={layoutHook.startDragging}
          onTabChange={editorHook.changeTab}
          onOutlineToggle={layoutHook.handleMobileOutlineToggle}
          onSearchClick={handleSearchClick}
          onSearchClose={handleSearchClose}
          onSearchQueryChange={handleSearchQueryChange}
          onSearchNext={handleSearchNext}
          onSearchPrev={handleSearchPrev}
          onSearchResultsChange={handleSearchResultsChange}
          onHeadingsExtracted={editorHook.handleHeadingsExtracted}
          onContentChange={editorHook.handleContentChange}
          onSave={() => void editorHook.saveFile()}
          onCloseDiff={fileHook.closeDiff}
          onCloseOutline={() => appStore.setOutlineOpen(false)}
          onCloseGitPanel={() => appStore.setGitPanelOpen(false)}
        />
      )}

      <GlobalDialogs
        activeProject={projectStore.state.activeProject}
        projects={projectStore.state.projects}
        settingsOpen={appStore.settingsOpen()}
        openProjectDialogOpen={appStore.openProjectDialogOpen()}
        colorPickerOpen={appStore.colorPickerOpen()}
        colorPickerProjectId={appStore.colorPickerProjectId()}
        colorPickerPosition={appStore.colorPickerPosition()}
        projectEditDialogOpen={appStore.projectEditDialogOpen()}
        trashDialogOpen={appStore.trashDialogOpen()}
        onCloseSettings={() => appStore.setSettingsOpen(false)}
        onSettingsSave={() => settingsStore.reloadSettings()}
        onCloseOpenProjectDialog={projectHook.closeOpenProjectDialog}
        onProjectOpened={(project) => void projectHook.handleProjectOpened(project)}
        onColorChange={(color) => void projectHook.updateProjectColor(color)}
        onCloseColorPicker={() => appStore.closeColorPicker()}
        onCloseProjectEditDialog={() => appStore.closeProjectEditDialog()}
        onProjectSave={(project) => void projectHook.saveProjectEdit(project)}
        onCloseTrashDialog={() => appStore.closeTrashDialog()}
        onTrashRestore={() => fileHook.handleTrashRestore()}
      />
    </>
  );
};

export default App;
