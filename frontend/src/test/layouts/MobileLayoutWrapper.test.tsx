import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { MobileLayoutWrapper } from '../../layouts/MobileLayoutWrapper';
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
});
