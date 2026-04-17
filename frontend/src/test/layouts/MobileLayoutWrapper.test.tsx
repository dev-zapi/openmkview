import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { MobileLayoutWrapper } from '../../layouts/MobileLayoutWrapper';
import { mobileLayoutStore } from '../../components/mobile';
import type { Project } from '../../types';
import type { Settings } from '../../types/app';

const settings: Settings = {
  markdownWidth: 'full',
  fixedWidth: '900px',
  themeMode: 'system',
  lightTheme: 'light-default',
  darkTheme: 'dark-default',
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  uiFontSize: '14px',
  markdownFontSize: '16px',
  protectedPaths: ['.git'],
  trashExpireDays: 30,
};

const project: Project = {
  id: 1,
  name: 'Demo',
  path: '/demo',
};

describe('MobileLayoutWrapper', () => {
  it('renders mobile layout shell', () => {
    const { container } = render(() => (
      <MobileLayoutWrapper
        projects={[]}
        activeProject={null}
        currentFile={null}
        currentFileType="markdown"
        imagePreviewUrl={null}
        imageFileName=""
        activeTab="preview"
        headings={[]}
        loading={false}
        editContent=""
        isDirty={false}
        saving={false}
        settings={settings}
        theme="light"
        themeMode="system"
        markdownStyle={{}}
        fileTree={[]}
        expandedFolders={new Set()}
        onOpenProject={() => {}}
        onOpenTrash={() => {}}
        onOpenSettings={() => {}}
        onToggleTheme={() => {}}
        onEditProject={() => {}}
        onOpenProjectColorChange={() => {}}
        onProjectClick={() => {}}
        onFileClick={() => {}}
        onFolderToggle={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onTabChange={() => {}}
        onOutlineToggle={() => {}}
        onHeadingsExtracted={() => {}}
        onContentChange={() => {}}
        onSave={() => {}}
        onCloseDiff={() => {}}
        renderProjectIcon={() => <span>A</span>}
        getProjectStyle={() => ({})}
      />
    ));

    expect(screen.getByLabelText('Toggle navigation menu')).toBeTruthy();
    expect(screen.getAllByText('OpenMKView').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.documentTitleBar').length).toBe(0);
  });

  it('switches project on click in mobile drawer', async () => {
    const onProjectClick = vi.fn();

    render(() => (
      <MobileLayoutWrapper
        projects={[project]}
        activeProject={project}
        currentFile={null}
        currentFileType="markdown"
        imagePreviewUrl={null}
        imageFileName=""
        activeTab="preview"
        headings={[]}
        loading={false}
        editContent=""
        isDirty={false}
        saving={false}
        settings={settings}
        theme="light"
        themeMode="system"
        markdownStyle={{}}
        fileTree={[]}
        expandedFolders={new Set()}
        onOpenProject={() => {}}
        onOpenTrash={() => {}}
        onOpenSettings={() => {}}
        onToggleTheme={() => {}}
        onEditProject={() => {}}
        onOpenProjectColorChange={() => {}}
        onOpenProjectColorChangeAt={() => {}}
        onProjectClick={onProjectClick}
        onFileClick={() => {}}
        onFolderToggle={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onTabChange={() => {}}
        onOutlineToggle={() => {}}
        onHeadingsExtracted={() => {}}
        onContentChange={() => {}}
        onSave={() => {}}
        onCloseDiff={() => {}}
        renderProjectIcon={() => <span>A</span>}
        getProjectStyle={() => ({})}
      />
    ));

    mobileLayoutStore.openLeftDrawer();
    const projectButton = await screen.findByLabelText('Demo');
    await fireEvent.click(projectButton);

    expect(onProjectClick).toHaveBeenCalledWith(project);
  });
});
