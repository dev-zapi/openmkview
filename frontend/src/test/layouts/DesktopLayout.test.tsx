import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { DesktopLayout } from '../../layouts/DesktopLayout';
import type { Settings } from '../../types/app';

const settings: Settings = {
  markdownWidth: { mode: 'full', fixedWidth: '900px' },
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

describe('DesktopLayout', () => {
  it('renders activity bar, sidebar and main content', () => {
    render(() => (
      <DesktopLayout
        projects={[{ id: 1, name: 'Alpha', path: '/alpha' }]}
        activeProject={{ id: 1, name: 'Alpha', path: '/alpha' }}
        themeMode="light"
        currentFile={null}
        currentFileType="markdown"
        imagePreviewUrl={null}
        imageFileName=""
        activeTab="preview"
        outlineOpen={false}
        headings={[]}
        loading={false}
        editContent=""
        isDirty={false}
        saving={false}
        settings={settings}
        theme="light"
        markdownStyle={{}}
        fileTree={[]}
        sidebarWidth={280}
        sidebarTransition="none"
        gitPanelOpen={false}
        onProjectClick={() => {}}
        onProjectContextMenu={() => {}}
        onOpenProject={() => {}}
        onToggleTheme={() => {}}
        onOpenTrash={() => {}}
        onOpenSettings={() => {}}
        renderProjectIcon={() => <span>A</span>}
        getProjectStyle={() => ({})}
        onRefreshProject={() => {}}
        onEditProject={() => {}}
        onCloseProject={() => {}}
        onFileClick={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onStartDragging={() => {}}
        onTabChange={() => {}}
        onOutlineToggle={() => {}}
        onHeadingsExtracted={() => {}}
        onContentChange={() => {}}
        onSave={() => {}}
        onCloseDiff={() => {}}
        onCloseOutline={() => {}}
        onCloseGitPanel={() => {}}
      />
    ));

    expect(screen.getByTitle('Alpha')).toBeTruthy();
    expect(screen.getByText('OpenMKView')).toBeTruthy();
  });
});
