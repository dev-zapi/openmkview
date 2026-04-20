import { beforeEach, describe, expect, it } from 'vitest';
import { projectStore } from '../../stores/projectStore';
import type { Project } from '../../types';

describe('projectStore', () => {
  const createProjects = (): Project[] => [
    { id: 6, name: 'openmkview', path: '/workspace/openmkview', color: '#c2185b' },
    { id: 3, name: 'workspace', path: '/workspace/workspace', color: '#FF6B6B' },
  ];

  let projects: Project[];

  beforeEach(() => {
    projects = createProjects();
    projectStore.setProjects([]);
    projectStore.setActiveProject(null);
    projectStore.setFileTree([]);
    projectStore.setCurrentFile(null);
    projectStore.setLoading(false);
  });

  it('clones project list input to avoid external aliasing', () => {
    projectStore.setProjects(projects);
    projects[0].name = 'mutated';

    expect(projectStore.state.projects[0].name).toBe('openmkview');
  });

  it('does not mutate project list when setting active project from list item', () => {
    projectStore.setProjects(projects);

    const originalList = projectStore.state.projects.map((project) => ({
      id: project.id,
      name: project.name,
    }));

    projectStore.setActiveProject(projectStore.state.projects[0]);

    expect(projectStore.state.projects.map((project) => ({
      id: project.id,
      name: project.name,
    }))).toEqual(originalList);
    expect(projectStore.state.activeProject).toEqual(projects[0]);
    expect(projectStore.state.activeProject).not.toBe(projectStore.state.projects[0]);
  });

  it('keeps project list stable when switching active project between entries', () => {
    projectStore.setProjects(projects);

    projectStore.setActiveProject(projectStore.state.projects[0]);
    projectStore.setActiveProject(projectStore.state.projects[1]);

    expect(projectStore.state.projects.map((project) => project.id)).toEqual([6, 3]);
    expect(projectStore.state.projects.map((project) => project.name)).toEqual([
      'openmkview',
      'workspace',
    ]);
    expect(projectStore.state.activeProject?.id).toBe(3);
    expect(projectStore.state.activeProject?.name).toBe('workspace');
  });
});
