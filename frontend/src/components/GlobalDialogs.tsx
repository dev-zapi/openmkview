import { Component, Show } from 'solid-js';
import SettingsPanel from './SettingsPanel';
import ColorPicker from './ColorPicker';
import ProjectEditDialog from './ProjectEditDialog';
import TrashDialog from './TrashDialog';
import type { Project } from '../types';
import { OpenProjectDialog } from './open-project';
import { authStore } from '../stores/authStore';

interface GlobalDialogsProps {
  activeProject: Project | null;
  projects: Project[];
  settingsOpen: boolean;
  openProjectDialogOpen: boolean;
  colorPickerOpen: boolean;
  colorPickerProjectId: number | null;
  colorPickerPosition: { x: number; y: number };
  projectEditDialogOpen: boolean;
  trashDialogOpen: boolean;
  onCloseSettings: () => void;
  onSettingsSave: () => void;
  onCloseOpenProjectDialog: () => void;
  onProjectOpened: (project: import('../types/openProject').RecentProject) => void;
  onColorChange: (color: string) => void;
  onCloseColorPicker: () => void;
  onCloseProject: () => void;
  onCloseProjectEditDialog: () => void;
  onProjectSave: (project: Project) => void;
  onCloseTrashDialog: () => void;
  onTrashRestore: () => void | Promise<void>;
}

export const GlobalDialogs: Component<GlobalDialogsProps> = (props) => {
  return (
    <>
      <Show when={props.activeProject}>
        <ProjectEditDialog
          project={props.activeProject!}
          isOpen={props.projectEditDialogOpen}
          onClose={props.onCloseProjectEditDialog}
          onSave={props.onProjectSave}
        />
      </Show>

      <SettingsPanel
        isOpen={props.settingsOpen}
        onClose={props.onCloseSettings}
        onSave={props.onSettingsSave}
        authRequired={authStore.authRequired()}
      />

      <OpenProjectDialog
        isOpen={props.openProjectDialogOpen}
        onClose={props.onCloseOpenProjectDialog}
        onProjectOpened={props.onProjectOpened}
      />

      <Show when={props.colorPickerOpen}>
        <div
          style={{
            position: 'fixed',
            top: `${props.colorPickerPosition.y}px`,
            left: `${props.colorPickerPosition.x}px`,
            'z-index': '2000',
          }}
        >
          <ColorPicker
            currentColor={props.projects.find((project) => project.id === props.colorPickerProjectId)?.color}
            onColorChange={props.onColorChange}
            onClose={props.onCloseColorPicker}
            onCloseProject={props.onCloseProject}
          />
        </div>
      </Show>

      <Show when={props.activeProject}>
        <TrashDialog
          isOpen={props.trashDialogOpen}
          projectId={props.activeProject!.id}
          onClose={props.onCloseTrashDialog}
          onRestore={props.onTrashRestore}
        />
      </Show>
    </>
  );
};

export default GlobalDialogs;
