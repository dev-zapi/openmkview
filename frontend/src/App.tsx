import { Component, createSignal, onMount, Show } from 'solid-js';
import FileTree from './components/FileTree';
import MarkdownView from './components/MarkdownView';
import DiffViewer from './components/DiffViewer';
import DiffSelector from './components/DiffSelector';
import { api } from './services/api';
import { diffStore } from './stores/diffStore';
import type { FileNode, FileContent } from './types';
import './styles/global.css';

const App: Component = () => {
  const [projects, setProjects] = createSignal<Array<{ id: number; name: string; path: string }>>([]);
  const [activeProject, setActiveProject] = createSignal<{ id: number; name: string } | null>(null);
  const [fileTree, setFileTree] = createSignal<FileNode[]>([]);
  const [currentFile, setCurrentFile] = createSignal<FileContent | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'preview' | 'source' | 'diff'>('preview');

  onMount(async () => {
    const projectList = await api.getProjects();
    setProjects(projectList);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProject = async (project: { id: number; name: string }) => {
    setActiveProject(project);
    const tree = await api.getFileTree(project.id);
    setFileTree(tree);
    diffStore.reset();
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

  return (
    <div class="app-container">
      <aside class="activity-bar">
        <button
          class={activeTab() === 'preview' ? 'active' : ''}
          title="Preview"
          onClick={() => setActiveTab('preview')}
        >
          📄
        </button>
        <button
          class={activeTab() === 'diff' ? 'active' : ''}
          title="Diff"
          onClick={() => setActiveTab('diff')}
        >
          📊
        </button>
        <button title="Git">🌿</button>
        <button title="Settings">⚙️</button>
      </aside>

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
              {projects().map((p) => (
                <div
                  class={`project-item ${activeProject()?.id === p.id ? 'active' : ''}`}
                  onClick={() => handleSwitchProject(p)}
                >
                  📁 {p.name}
                </div>
              ))}
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
            <span class="file-name">{currentFile()!.fileName}</span>
          </Show>
        </header>

        <div class="main-content">
          <Show when={loading()}>
            <div class="loading">Loading...</div>
          </Show>

          <Show when={!loading() && !currentFile() && activeTab() === 'preview'}>
            <div class="welcome">
              <h1>OpenMKView</h1>
              <p>Click "Open Project" to get started</p>
            </div>
          </Show>

          <Show when={!loading() && currentFile() && activeTab() === 'preview'}>
            <MarkdownView content={currentFile()!.content} />
          </Show>

          <Show when={!loading() && activeTab() === 'diff' && activeProject() && currentFile()}>
            <DiffSelector
              projectId={activeProject()!.id}
              filePath={currentFile()!.path}
            />

            <Show when={diffStore.state.isDiffMode && diffStore.state.diffData}>
              <DiffViewer
                diffData={diffStore.state.diffData!}
                theme="light"
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
      </main>
    </div>
  );
};

export default App;
