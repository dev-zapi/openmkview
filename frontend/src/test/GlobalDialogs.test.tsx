import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import GlobalDialogs from '../components/GlobalDialogs';

describe('GlobalDialogs', () => {
  const project = { id: 1, name: 'Alpha', path: '/alpha', color: '#ff0000' };

  it('renders settings and open project dialogs', () => {
    render(() => (
      <GlobalDialogs
        activeProject={project}
        projects={[project]}
        settingsOpen={true}
        openProjectDialogOpen={true}
        colorPickerOpen={false}
        colorPickerProjectId={null}
        colorPickerPosition={{ x: 0, y: 0 }}
        projectEditDialogOpen={false}
        trashDialogOpen={false}
        onCloseSettings={() => {}}
        onSettingsSave={() => {}}
        onCloseOpenProjectDialog={() => {}}
        onProjectOpened={() => {}}
        onColorChange={() => {}}
        onCloseColorPicker={() => {}}
        onCloseProjectEditDialog={() => {}}
        onProjectSave={() => {}}
        onCloseTrashDialog={() => {}}
        onTrashRestore={() => {}}
      />
    ));

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Open project')).toBeTruthy();
  });

  it('renders color picker when open', () => {
    render(() => (
      <GlobalDialogs
        activeProject={project}
        projects={[project]}
        settingsOpen={false}
        openProjectDialogOpen={false}
        colorPickerOpen={true}
        colorPickerProjectId={1}
        colorPickerPosition={{ x: 10, y: 20 }}
        projectEditDialogOpen={false}
        trashDialogOpen={false}
        onCloseSettings={() => {}}
        onSettingsSave={() => {}}
        onCloseOpenProjectDialog={() => {}}
        onProjectOpened={() => {}}
        onColorChange={() => {}}
        onCloseColorPicker={() => {}}
        onCloseProjectEditDialog={() => {}}
        onProjectSave={() => {}}
        onCloseTrashDialog={() => {}}
        onTrashRestore={() => {}}
      />
    ));

    expect(screen.getByText('Select Color')).toBeTruthy();
  });
});
