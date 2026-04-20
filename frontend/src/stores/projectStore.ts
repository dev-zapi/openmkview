import { createStore } from 'solid-js/store';
import type { Project, FileNode, FileContent } from '../types';

const cloneProject = (project: Project): Project => ({ ...project });

const cloneProjects = (projects: Project[]): Project[] => projects.map(cloneProject);

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  fileTree: FileNode[];
  currentFile: FileContent | null;
  loading: boolean;
}

const [projectState, setProjectState] = createStore<ProjectState>({
  projects: [],
  activeProject: null,
  fileTree: [],
  currentFile: null,
  loading: false,
});

export const projectStore = {
  state: projectState,

  setProjects(projects: Project[]) {
    setProjectState('projects', cloneProjects(projects));
  },

  addProject(project: Project) {
    setProjectState('projects', [...projectState.projects, cloneProject(project)]);
  },

  setActiveProject(project: Project | null) {
    setProjectState('activeProject', project ? cloneProject(project) : null);
  },

  setFileTree(tree: FileNode[]) {
    setProjectState('fileTree', tree);
  },

  setCurrentFile(file: FileContent | null) {
    setProjectState('currentFile', file);
  },

  setLoading(loading: boolean) {
    setProjectState('loading', loading);
  },

  removeProject(id: number) {
    setProjectState(
      'projects',
      projectState.projects.filter((p) => p.id !== id)
    );
    if (projectState.activeProject?.id === id) {
      setProjectState('activeProject', null);
      setProjectState('fileTree', []);
      setProjectState('currentFile', null);
    }
  },

  updateProject(id: number, updates: Partial<Project>) {
    setProjectState(
      'projects',
      projectState.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
    );
    if (projectState.activeProject?.id === id) {
      setProjectState('activeProject', { ...projectState.activeProject, ...updates });
    }
  },
};

export default projectStore;
