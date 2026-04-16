import { Component } from 'solid-js';
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

  useLifecycle();

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
    mobileLayoutStore.closeLeftDrawer();
    await projectHook.switchProject(project);
  };

  const handleMobileOpenProjectColorChange = (event: MouseEvent) => {
    const project = projectStore.state.activeProject;
    if (!project) return;
    projectHook.openColorPicker(event, project.id);
  };

  const theme = settingsStore.effectiveTheme;
  const markdownStyle = getMarkdownStyle(settingsStore.settings());

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
          markdownStyle={markdownStyle}
          fileTree={fileStore.fileTree()}
          expandedFolders={fileStore.expandedFolders()}
          onOpenProject={projectHook.openProject}
          onOpenSettings={() => appStore.setSettingsOpen(true)}
          onToggleTheme={() => settingsStore.toggleThemeMode()}
          onEditProject={() => appStore.openProjectEditDialog()}
          onOpenProjectColorChange={handleMobileOpenProjectColorChange}
          onProjectClick={handleMobileProjectClick}
          onFileClick={(path) => fileHook.mobileFileClick(path)}
          onFolderToggle={fileHook.toggleFolder}
          onDelete={(node) => void fileHook.deleteFile(node)}
          onCopyPath={(node) => void fileHook.copyPath(node)}
          onRename={fileHook.renameFile}
          onTabChange={editorHook.changeTab}
          onOutlineToggle={layoutHook.handleMobileOutlineToggle}
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
          markdownStyle={markdownStyle}
          fileTree={fileStore.fileTree()}
          expandedFolders={fileStore.expandedFolders()}
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
          onFolderToggle={fileHook.toggleFolder}
          onDelete={(node) => void fileHook.deleteFile(node)}
          onCopyPath={(node) => void fileHook.copyPath(node)}
          onRename={fileHook.renameFile}
          onStartDragging={layoutHook.startDragging}
          onTabChange={editorHook.changeTab}
          onOutlineToggle={layoutHook.handleMobileOutlineToggle}
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
