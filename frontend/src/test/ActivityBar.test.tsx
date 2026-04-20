import { createSignal } from 'solid-js';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ActivityBar from '../components/ActivityBar';

const projects = [
  { id: 1, name: 'Alpha', path: '/alpha', color: '#ff0000' },
  { id: 2, name: 'Beta', path: '/beta' },
];

describe('ActivityBar', () => {
  it('renders project buttons and action buttons', () => {
    render(() => (
      <ActivityBar
        projects={projects}
        activeProject={projects[0]}
        themeMode="dark"
        onProjectClick={() => {}}
        onProjectContextMenu={() => {}}
        onOpenProject={() => {}}
        onToggleTheme={() => {}}
        onOpenTrash={() => {}}
        onOpenSettings={() => {}}
        renderProjectIcon={(project) => <span>{project.name[0]}</span>}
        getProjectStyle={() => ({})}
      />
    ));

    expect(screen.getByTitle('Alpha')).toBeTruthy();
    expect(screen.getByTitle('Beta')).toBeTruthy();
    expect(screen.getByTitle('Open Project')).toBeTruthy();
    expect(screen.getByTitle('Settings')).toBeTruthy();
    expect(screen.getByTitle('Trash')).toBeTruthy();
  });

  it('calls handlers when buttons clicked', () => {
    const onProjectClick = vi.fn();
    const onOpenProject = vi.fn();
    const onToggleTheme = vi.fn();

    render(() => (
      <ActivityBar
        projects={projects}
        activeProject={projects[0]}
        themeMode="light"
        onProjectClick={onProjectClick}
        onProjectContextMenu={() => {}}
        onOpenProject={onOpenProject}
        onToggleTheme={onToggleTheme}
        onOpenTrash={() => {}}
        onOpenSettings={() => {}}
        renderProjectIcon={(project) => <span>{project.name[0]}</span>}
        getProjectStyle={() => ({})}
      />
    ));

    fireEvent.click(screen.getByTitle('Alpha'));
    fireEvent.click(screen.getByTitle('Open Project'));
    fireEvent.click(screen.getByTitle('Theme: light (click to toggle)'));

    expect(onProjectClick).toHaveBeenCalledWith(projects[0]);
    expect(onOpenProject).toHaveBeenCalled();
    expect(onToggleTheme).toHaveBeenCalled();
  });

  it('updates active class when active project changes', () => {
    const [activeProject, setActiveProject] = createSignal(projects[0]);

    render(() => (
      <ActivityBar
        projects={projects}
        activeProject={activeProject()}
        themeMode="light"
        onProjectClick={() => {}}
        onProjectContextMenu={() => {}}
        onOpenProject={() => {}}
        onToggleTheme={() => {}}
        onOpenTrash={() => {}}
        onOpenSettings={() => {}}
        renderProjectIcon={(project) => <span>{project.name[0]}</span>}
        getProjectStyle={(project) => project.color ? { background: project.color } : {}}
      />
    ));

    const alphaButton = screen.getByTitle('Alpha');
    const betaButton = screen.getByTitle('Beta');

    expect(alphaButton.classList.contains('active')).toBe(true);
    expect(betaButton.classList.contains('active')).toBe(false);
    expect(alphaButton.getAttribute('style')).toContain('background: rgb(255, 0, 0)');

    setActiveProject(projects[1]);

    const alphaButtonAfterSwitch = screen.getByTitle('Alpha');

    expect(alphaButtonAfterSwitch.classList.contains('active')).toBe(false);
    expect(alphaButtonAfterSwitch.classList.contains('project-color-hint')).toBe(true);
    expect(alphaButtonAfterSwitch.style.getPropertyValue('--project-color')).toBe('#ff0000');
    expect(alphaButtonAfterSwitch.style.background).toBe('transparent');
    expect(betaButton.classList.contains('active')).toBe(true);
  });
});
