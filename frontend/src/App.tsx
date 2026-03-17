import { Component, createSignal, onMount, Show, createEffect, For } from 'solid-js';
import FileTree from './components/FileTree';
import MarkdownView from './components/MarkdownView';
import DiffViewer from './components/DiffViewer';
import DiffSelector from './components/DiffSelector';
import GitPanel from './components/GitPanel';
import OutlinePanel from './components/OutlinePanel';
import SettingsPanel from './components/SettingsPanel';
import { api } from './services/api';
import { diffStore } from './stores/diffStore';
import type { FileNode, FileContent, Project } from './types';
import './styles/global.css';

// Load settings from localStorage
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('openmkview-settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { markdownWidth: 'full', fixedWidth: '900px', theme: 'light' };
};

const App: Component = () => {
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [activeProject, setActiveProject] = createSignal<Project | null>(null);
  const [fileTree, setFileTree] = createSignal<FileNode[]>([]);
  const [currentFile, setCurrentFile] = createSignal<FileContent | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'preview' | 'source' | 'diff'>('preview');
  const [activePanel, setActivePanel] = createSignal<'explorer' | 'git' | 'settings'>('explorer');
  const [gitPanelOpen, setGitPanelOpen] = createSignal(false);
  const [outlineOpen, setOutlineOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [settings, setSettings] = createSignal(loadSettings());

  onMount(async () => {
    const projectList = await api.getProjects();
    setProjects(projectList);

    // Apply theme on mount
    const s = settings();
    if (s.theme === 'dark') {
      document.body.classList.add('dark-theme');
    }
  });

  createEffect(() => {
    // Re-apply settings when they change
    const s = settings();
    if (s.theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  });

  const handleOpenProject = async () => {
    const path = prompt('Project directory path:');
    if (!path) return;

    setLoading(true);
    try {
      const project = await api.createProject(path);
      setProjects([...projects(), project]);
      await handleSwitchProject(project);
    } catch (error) {
      console.error('Failed to open project:', error);
      alert('Failed to open project. Please check the path and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProject = async (project: Project) => {
    setActiveProject(project);
    setLoading(true);
    try {
      const tree = await api.getFileTree(project.id);
      setFileTree(tree);
      diffStore.reset();
      setCurrentFile(null);
    } catch (error) {
      console.error('Failed to load file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseProject = async (e: Event, projectId: number) => {
    e.stopPropagation();
    try {
      await api.deleteProject(projectId);
      const updated = projects().filter(p => p.id !== projectId);
      setProjects(updated);
      if (activeProject()?.id === projectId) {
        setActiveProject(null);
        setFileTree([]);
        setCurrentFile(null);
        if (updated.length > 0) {
          await handleSwitchProject(updated[0]);
        }
      }
    } catch (error) {
      console.error('Failed to close project:', error);
    }
  };

  const handleFileClick = async (path: string, _name: string) => {
    const project = activeProject();
    if (!project) return;

    setLoading(true);
    try {
      const content = await api.getFileContent(path, project.id);
      setCurrentFile(content);
      setActiveTab('preview');
      diffStore.reset();
    } catch (error) {
      console.error('Failed to load file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDiff = () => {
    diffStore.reset();
    setActiveTab('preview');
  };

  const getMarkdownStyle = () => {
    const s = settings();
    if (s.markdownWidth === 'fixed') {
      return {
        'max-width': s.fixedWidth,
        'margin-left': 'auto',
        'margin-right': 'auto',
      };
    }
    return {};
  };

  return (
    <div class="app-container">
      <aside class="activity-bar">
        <button
          class={activePanel() === 'explorer' ? 'active' : ''}
          title="Explorer"
          onClick={() => setActivePanel('explorer')}
        >
          📁
        </button>
        <button
          class={gitPanelOpen() ? 'active' : ''}
          title="Git"
          onClick={() => setGitPanelOpen(!gitPanelOpen())}
        >
          🌿
        </button>
        <button
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙️
        </button>
      </aside>

      <Show when={activePanel() === 'explorer'}>
        <aside class="sidebar">
          <div class="sidebar-header">Explorer</div>
          <div class="sidebar-content">
            <button class="btn" onClick={handleOpenProject} disabled={loading()}>
              📂 Open Project
            </button>

            <Show when={projects().length > 0} fallback={
              <p class="empty-state">No projects</p>
            }>
              <div class="project-list">
                <For each={projects()}>
                  {(p) => (
                    <div
                      class={`project-item ${activeProject()?.id === p.id ? 'active' : ''}`}
                      onClick={() => handleSwitchProject(p)}
                    >
                      <span class="project-name">📁 {p.name}</span>
                      <button
                        class="project-close"
                        onClick={(e) => handleCloseProject(e, p.id)}
                        title="Close project"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={activeProject()}>
              <FileTree
                nodes={fileTree()}
                onFileClick={handleFileClick}
              />
            </Show>
          </div>
        </aside>
      </Show>

      <main class="main">
        <header class="main-header">
          <div class="tabs">
            <div
              class={`tab ${activeTab() === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </div>
            <div
              class={`tab ${activeTab() === 'diff' ? 'active' : ''}`}
              onClick={() => setActiveTab('diff')}
            >
              Diff
            </div>
            <div
              class={`tab ${activeTab() === 'source' ? 'active' : ''}`}
              onClick={() => setActiveTab('source')}
            >
              Source
            </div>
          </div>
          <Show when={currentFile()}>
            <div class="header-right">
              <span class="file-name">{currentFile()!.fileName}</span>
              <button
                class="outline-toggle"
                onClick={() => setOutlineOpen(!outlineOpen())}
                title="Toggle Outline"
              >
                📋
              </button>
            </div>
          </Show>
        </header>

        <div class="main-content">
          <Show when={loading()}>
            <div class="loading">Loading...</div>
          </Show>

          <div class="content-area">
            <div class="content-main" classList={{ 'with-outline': outlineOpen() }}>
              <Show when={!loading() && !currentFile() && activeTab() === 'preview'}>
                <div class="welcome">
                  <h1>OpenMKView</h1>
                  <p>Click "Open Project" to get started</p>
                </div>
              </Show>

              <Show when={!loading() && currentFile() && activeTab() === 'preview'}>
                <div class="markdown-wrapper" style={getMarkdownStyle()}>
                  <MarkdownView content={currentFile()!.content} />
                </div>
              </Show>

              <Show when={!loading() && activeTab() === 'diff' && activeProject() && currentFile()}>
                <DiffSelector
                  projectId={activeProject()!.id}
                  filePath={currentFile()!.path}
                />

                <Show when={diffStore.state.isDiffMode && diffStore.state.diffData}>
                  <DiffViewer
                    diffData={diffStore.state.diffData!}
                    theme={settings().theme}
                    mode="split"
                    onClose={handleCloseDiff}
                  />
                </Show>

                <Show when={!diffStore.state.isDiffMode && !diffStore.state.diffData}>
                  <div class="diff-empty">
                    <p>Select versions to compare</p>
                  </div>
                </Show>
              </Show>

              <Show when={!loading() && currentFile() && activeTab() === 'source'}>
                <pre class="source-view">
                  <code>{currentFile()!.content}</code>
                </pre>
              </Show>
            </div>

            <OutlinePanel
              headings={currentFile()?.headings || []}
              isOpen={outlineOpen()}
              onClose={() => setOutlineOpen(false)}
            />
          </div>
        </div>
      </main>

      <GitPanel
        projectId={activeProject()?.id || 0}
        isOpen={gitPanelOpen()}
        onClose={() => setGitPanelOpen(false)}
      />

      <SettingsPanel
        isOpen={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
