import { Component, createSignal, onMount, Show, createEffect, For, onCleanup } from 'solid-js';
import FileTree from './components/FileTree';
import MarkdownView from './components/MarkdownView';
import DiffViewer from './components/DiffViewer';
import DiffSelector from './components/DiffSelector';
import GitPanel from './components/GitPanel';
import OutlinePanel from './components/OutlinePanel';
import SettingsPanel from './components/SettingsPanel';
import ColorPicker from './components/ColorPicker';
import ProjectEditDialog from './components/ProjectEditDialog';
import { MarkdownHeader } from './components/markdown-header';
import { OpenProjectDialog } from './components/open-project';
import { MobileLayout, mobileLayoutStore } from './components/mobile';
import type { Project, FileNode, FileContent, Heading } from './types';
import type { RecentProject } from './types/openProject';
import { api } from './services/api';
import { onPopState, getCurrentRoute, navigateToProject, navigateToHome, navigateToFile } from './utils/router';
import { openProjectStore } from './stores/openProjectStore';
import { diffStore } from './stores/diffStore';
import './styles/global.css';
import './components/ColorPicker.css';
import './components/ProjectEditDialog.css';

type ThemeMode = 'light' | 'dark' | 'system';

const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

  const loadSettings = () => {
  try {
    const saved = localStorage.getItem('openmkview-settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {
    markdownWidth: 'full',
    fixedWidth: '900px',
    theme: 'system' as ThemeMode,
    uiFontFamily: 'MiSans, sans-serif',
    markdownFontFamily: 'Georgia, "Noto Serif", serif',
    uiFontSize: '14px',
    markdownFontSize: '16px',
  };
};

const loadSidebarWidth = () => {
  try {
    const saved = localStorage.getItem('filetree-sidebar-width');
    if (saved) {
      const width = parseInt(saved, 10);
      const maxWidth = window.innerWidth * 0.4;
      if (width >= 200 && width <= maxWidth) {
        return width;
      }
    }
  } catch (e) {
    console.error('Failed to load sidebar width:', e);
  }
  return 280;
};

const applyTheme = (theme: ThemeMode) => {
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(`${effectiveTheme}-theme`);
};

const App: Component = () => {
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [activeProject, setActiveProject] = createSignal<Project | null>(null);
  const [fileTree, setFileTree] = createSignal<FileNode[]>([]);
  const [currentFile, setCurrentFile] = createSignal<FileContent | null>(null);
  const [extractedHeadings, setExtractedHeadings] = createSignal<Heading[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'preview' | 'source' | 'diff'>('preview');
  const [gitPanelOpen, setGitPanelOpen] = createSignal(false);
  const [outlineOpen, setOutlineOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [settings, setSettings] = createSignal(loadSettings());
  const [systemTheme, setSystemTheme] = createSignal<'light' | 'dark'>(getSystemTheme());
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set());
  const [isOpenProjectDialogOpen, setIsOpenProjectDialogOpen] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);
  const [sidebarWidth, setSidebarWidth] = createSignal(280);
  const [colorPickerOpen, setColorPickerOpen] = createSignal(false);
  const [colorPickerProjectId, setColorPickerProjectId] = createSignal<number | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = createSignal({ x: 0, y: 0 });
  const [projectMenuOpen, setProjectMenuOpen] = createSignal(false);
  const [projectEditDialogOpen, setProjectEditDialogOpen] = createSignal(false);

  const [isDragging, setIsDragging] = createSignal(false);
  let mediaQuery: MediaQueryList;
  let sidebarRef: HTMLDivElement | undefined;

  onMount(async () => {
    const projectList = await api.getProjects();
    setProjects(projectList);

    applyTheme(settings().theme as ThemeMode);

    setSidebarWidth(loadSidebarWidth());

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleWindowResize = () => {
      const maxWidth = window.innerWidth * 0.4;
      const currentWidth = sidebarWidth();
      if (currentWidth > maxWidth) {
        setSidebarWidth(maxWidth);
        localStorage.setItem('filetree-sidebar-width', String(maxWidth));
      }
    };
    window.addEventListener('resize', handleWindowResize);
    
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
      if (settings().theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleThemeChange);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging()) {
        const maxWidth = window.innerWidth * 0.4;
        const newWidth = Math.max(200, Math.min(maxWidth, e.clientX - 52));
        setSidebarWidth(newWidth);
        localStorage.setItem('filetree-sidebar-width', String(newWidth));
      }
    };

    const handleMouseUp = () => {
      if (isDragging()) {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    const cleanupPopState = onPopState(async (route) => {
      if (route.projectId) {
        const project = projects().find(p => p.id === route.projectId);
        if (project) {
          await handleSwitchProject(project, false);
          if (route.filePath) {
            await handleFileClick(route.filePath, '', false);
          }
        }
      } else {
        setActiveProject(null);
        setFileTree([]);
        setCurrentFile(null);
        setExpandedFolders(new Set<string>());
      }
    });

    const route = getCurrentRoute();
    if (route.projectId) {
      const project = projectList.find(p => p.id === route.projectId);
      if (project) {
        await handleSwitchProject(project, false);
        if (route.filePath) {
          await handleFileClick(route.filePath, '', false);
        }
      }
    }
    
    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleThemeChange);
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      cleanupPopState();
    });
  });

  createEffect(() => {
    applyTheme(settings().theme as ThemeMode);
  });

  // Apply font settings
  createEffect(() => {
    const s = settings();
    // Apply UI font
    document.body.style.fontFamily = s.uiFontFamily;
    document.body.style.fontSize = s.uiFontSize;
    // Apply Markdown font via CSS variables
    document.documentElement.style.setProperty('--markdown-font', s.markdownFontFamily);
    document.documentElement.style.setProperty('--markdown-size', s.markdownFontSize);
  });

  const toggleTheme = () => {
    const currentTheme = settings().theme;
    const themes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setSettings(prev => ({ ...prev, theme: nextTheme }));
  };

  const handleSettingsSave = () => {
    setSettings(loadSettings());
  };

  // 打开项目对话框
  const handleOpenProject = () => {
    setIsOpenProjectDialogOpen(true);
  };

  // 关闭项目对话框
  const handleCloseOpenProjectDialog = () => {
    setIsOpenProjectDialogOpen(false);
  };

  // 项目打开成功回调
  const handleProjectOpened = async (recentProject: RecentProject) => {
    setLoading(true);
    setIsOpenProjectDialogOpen(false);
    
    try {
      const project: Project = {
        id: parseInt(recentProject.id, 10),
        name: recentProject.name,
        path: recentProject.path,
        color: recentProject.color,
      };
      
      const existingProject = projects().find(p => p.id === project.id);
      if (!existingProject) {
        setProjects([...projects(), project]);
      }
      
      await handleSwitchProject(project);
      
      openProjectStore.addRecentProject(recentProject);
    } catch (error) {
      console.error('Failed to open project:', error);
      alert('Failed to open project. Please check the path and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProject = async (project: Project, updateUrl: boolean = true) => {
    setActiveProject(project);
    setLoading(true);
    try {
      const tree = await api.getFileTree(project.id);
      setFileTree(tree);
      diffStore.reset();
      setCurrentFile(null);
      if (updateUrl) {
        navigateToProject(project.id);
      }
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
        setExpandedFolders(new Set<string>());
        navigateToHome();
        if (updated.length > 0) {
          await handleSwitchProject(updated[0]);
        }
      }
    } catch (error) {
      console.error('Failed to close project:', error);
    }
  };

  const handleFileClick = async (path: string, _relativePath: string, updateUrl: boolean = true) => {
    const project = activeProject();
    if (!project) return;

    setLoading(true);
    try {
      const content = await api.getFileContent(path, project.id);
      setCurrentFile(content);
      setExtractedHeadings([]);
      setActiveTab('preview');
      diffStore.reset();
      if (updateUrl) {
        navigateToFile(project.id, path);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHeadingsExtracted = (headings: Heading[]) => {
    setExtractedHeadings(headings);
  };

  const handleFolderToggle = (path: string, expanded: boolean) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(path);
      } else {
        newSet.delete(path);
      }
      return newSet;
    });
  };

  const handleCloseDiff = () => {
    diffStore.reset();
    setActiveTab('preview');
  };

  const handleMobileOutlineToggle = () => {
    if (isMobile()) {
      mobileLayoutStore.toggleRightDrawer();
    } else {
      setOutlineOpen(!outlineOpen());
    }
  };

  // Wrap file click for mobile to also close the drawer
  const handleMobileFileClick = async (path: string, relativePath: string, updateUrl?: boolean) => {
    mobileLayoutStore.closeLeftDrawer();
    await handleFileClick(path, relativePath, updateUrl);
  };

  // Wrap project switch for mobile to also close the drawer
  const handleMobileProjectSwitch = async (project: Project) => {
    mobileLayoutStore.closeLeftDrawer();
    await handleSwitchProject(project);
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

  const handleColorChange = async (color: string) => {
    const projectId = colorPickerProjectId();
    if (!projectId) return;

    try {
      await api.updateProjectColor(projectId, color);
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, color } : p
      ));
      
      if (activeProject()?.id === projectId) {
        setActiveProject(prev => prev ? { ...prev, color } : null);
      }
    } catch (error) {
      console.error('Failed to update project color:', error);
    }
    
    setColorPickerOpen(false);
    setColorPickerProjectId(null);
  };

  const handleColorPickerOpen = (e: MouseEvent, projectId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.right + 8;
    const y = rect.top;
    
    const pickerWidth = 280;
    const pickerHeight = 300;
    
    const adjustedX = x + pickerWidth > window.innerWidth ? rect.left - pickerWidth - 8 : x;
    const adjustedY = y + pickerHeight > window.innerHeight ? window.innerHeight - pickerHeight - 8 : y;
    
    setColorPickerPosition({ x: adjustedX, y: adjustedY });
    setColorPickerProjectId(projectId);
    setColorPickerOpen(true);
  };

  const getColorStyle = (project: Project) => {
    return project.color ? { background: project.color } : {};
  };

  const handleProjectMenuToggle = (e: MouseEvent) => {
    e.stopPropagation();
    setProjectMenuOpen(!projectMenuOpen());
  };

  const handleProjectEdit = () => {
    setProjectMenuOpen(false);
    setProjectEditDialogOpen(true);
  };

  const handleProjectSave = async (project: Project) => {
    try {
      const updatedProject = await api.updateProject(project.id, {
        name: project.name,
        color: project.color,
        icon: project.icon,
      });
      
      setProjects(prev => prev.map(p => 
        p.id === updatedProject.id ? updatedProject : p
      ));
      
      if (activeProject()?.id === updatedProject.id) {
        setActiveProject(updatedProject);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('Failed to update project');
    }
    
    setProjectEditDialogOpen(false);
  };

  const getProjectDisplayName = (project: Project) => {
    return project.icon ? project.icon : project.name.charAt(0).toUpperCase();
  };

  const isFaviconIcon = (icon: string | null | undefined): boolean => {
    return icon?.startsWith('favicon:') ?? false;
  };

  const getFaviconPath = (icon: string): string => {
    return icon.replace('favicon:', '');
  };

  const renderProjectIcon = (project: Project) => {
    if (isFaviconIcon(project.icon)) {
      const faviconPath = getFaviconPath(project.icon!);
      return (
        <img 
          src={`/api/files/content?path=${encodeURIComponent(faviconPath)}&project_id=${project.id}`}
          alt="favicon"
          class="project-favicon"
        />
      );
    }
    return <span class="project-initial">{getProjectDisplayName(project)}</span>;
  };

  const renderSidebarHeaderIcon = (project: Project) => {
    if (isFaviconIcon(project.icon)) {
      const faviconPath = getFaviconPath(project.icon!);
      return (
        <img 
          src={`/api/files/content?path=${encodeURIComponent(faviconPath)}&project_id=${project.id}`}
          alt="favicon"
          class="sidebar-header-favicon"
        />
      );
    }
    return getProjectDisplayName(project);
  };

  return (
    <>
      {/* Desktop layout */}
      <Show when={!isMobile()}>
        <div class="app-container">
          <aside class="activity-bar">
            {/* 项目列表区域 - 可滚动 */}
            <div class="activity-bar-projects"
            >
              <For each={projects()}>
                {(p) => (
                  <button
                    class={activeProject()?.id === p.id ? 'active' : ''}
                    title={p.name}
                    onClick={() => handleSwitchProject(p)}
                    onContextMenu={(e) => handleColorPickerOpen(e, p.id)}
                    style={getColorStyle(p)}
                  >
                    {renderProjectIcon(p)}
                  </button>
                )}
              </For>
            </div>

            {/* 加号按钮 */}
            <button
              class="activity-bar-add"
              title="Open Project"
              onClick={handleOpenProject}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            {/* 底部固定区域 */}
            <div class="activity-bar-bottom">
              <button
                class={settings().theme === 'dark' ? 'active' : ''}
                title={`Theme: ${settings().theme} (click to toggle)`}
                onClick={toggleTheme}
              >
                <Show when={settings().theme === 'light'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                </Show>
                <Show when={settings().theme === 'dark'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                </Show>
                <Show when={settings().theme === 'system'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </Show>
              </button>
              <button
                title="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
          </aside>

          <Show when={activeProject()}>
            <aside 
              class="sidebar sidebar-enter" 
              ref={sidebarRef}
              style={{ width: `${sidebarWidth()}px`, transition: isDragging() ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <div class="sidebar-header">
                <Show when={activeProject()}>
                  <div class="sidebar-header-content">
                    <span class="sidebar-header-icon" style={activeProject()?.color ? { background: activeProject()?.color } : {}}>
                      {renderSidebarHeaderIcon(activeProject()!)}
                    </span>
                    <span class="sidebar-header-name">{activeProject()?.name}</span>
                    <button class="sidebar-header-menu" onClick={handleProjectMenuToggle}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                    <Show when={projectMenuOpen()}>
                      <div class="sidebar-header-menu-dropdown">
                        <button class="menu-item" onClick={handleProjectEdit}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          <span>Edit Project Info</span>
                        </button>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
              <div class="sidebar-content">
                <FileTree
                  nodes={fileTree()}
                  onFileClick={handleFileClick}
                  expandedFolders={expandedFolders()}
                  onFolderToggle={handleFolderToggle}
                />
              </div>
              {/* Resize handle */}
              <div 
                class="sidebar-resize-handle"
                onMouseDown={() => {
                  setIsDragging(true);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
              />
            </aside>
          </Show>

          <main class="main">
            <div class="main-left">
              <Show when={currentFile()}>
                <MarkdownHeader
                  fileName={currentFile()!.fileName}
                  lastModified={currentFile()!.lastModified ? new Date(currentFile()!.lastModified!) : undefined}
                  fileSize={currentFile()!.fileSize}
                  activeTab={activeTab()}
                  isOutlineOpen={outlineOpen()}
                  outlineCount={extractedHeadings().length}
                  content={currentFile()!.content}
                  onTabChange={(tab) => setActiveTab(tab)}
                  onOutlineToggle={handleMobileOutlineToggle}
                />
              </Show>

              <div class="main-content">
                <Show when={loading()}>
                  <div class="loading">Loading...</div>
                </Show>

                <div class="content-area">
                  <div class="content-main">
                    <Show when={!loading() && !currentFile() && activeTab() === 'preview'}>
                      <div class="welcome">
                        <h1>OpenMKView</h1>
<p>Click "Open Project" or the + button on the left to start</p>
                      </div>
                    </Show>

                    <Show when={!loading() && currentFile() && activeTab() === 'preview'}>
                      <div class="markdown-wrapper content-fade-enter" style={getMarkdownStyle()}>
                        <MarkdownView 
                          content={currentFile()!.content} 
                          onHeadingsExtracted={handleHeadingsExtracted} 
                        />
                      </div>
                    </Show>

                    <Show when={!loading() && activeTab() === 'diff' && activeProject() && currentFile()}>
                      <div class="content-fade-enter">
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
                      </div>
                    </Show>

                    <Show when={!loading() && currentFile() && activeTab() === 'source'}>
                      <pre class="source-view content-fade-enter">
                        <code>{currentFile()!.content}</code>
                      </pre>
                    </Show>
                  </div>
                </div>
              </div>
            </div>

            <OutlinePanel
              headings={extractedHeadings()}
              isOpen={outlineOpen()}
              onClose={() => setOutlineOpen(false)}
            />
          </main>

          <GitPanel
            projectId={activeProject()?.id || 0}
            isOpen={gitPanelOpen()}
            onClose={() => setGitPanelOpen(false)}
          />
        </div>
      </Show>

      {/* Project Edit Dialog */}
      <Show when={activeProject()}>
        <ProjectEditDialog
          project={activeProject()!}
          isOpen={projectEditDialogOpen()}
          onClose={() => setProjectEditDialogOpen(false)}
          onSave={handleProjectSave}
        />
      </Show>

      {/* Mobile layout */}
      <Show when={isMobile()}>
        <MobileLayout
          activeProjectName={activeProject()?.name}
          onSettingsClick={() => setSettingsOpen(true)}
          onThemeToggle={toggleTheme}
          currentTheme={settings().theme as ThemeMode}
          activityBarContent={
            <>
              <For each={projects()}>
                {(p) => (
                  <button
                    class={activeProject()?.id === p.id ? 'active' : ''}
                    title={p.name}
                    onClick={() => handleMobileProjectSwitch(p)}
                    onContextMenu={(e) => handleColorPickerOpen(e, p.id)}
                    style={getColorStyle(p)}
                  >
                    {renderProjectIcon(p)}
                    <span class="mobile-project-name">{p.name}</span>
                  </button>
                )}
              </For>
              <button
                class="activity-bar-add"
                title="Open Project"
                onClick={() => {
                  mobileLayoutStore.closeLeftDrawer();
                  handleOpenProject();
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span class="mobile-project-name">Open Project</span>
              </button>
            </>
          }
          sidebarContent={
            <Show when={activeProject()} fallback={
              <p class="empty-state">Tap the + button above to open a project</p>
            }>
              <FileTree
                nodes={fileTree()}
                onFileClick={handleMobileFileClick}
                expandedFolders={expandedFolders()}
                onFolderToggle={handleFolderToggle}
              />
            </Show>
          }
          outlinePanelContent={
            <OutlinePanel
              headings={extractedHeadings()}
              isOpen={mobileLayoutStore.rightDrawerOpen}
              onClose={() => mobileLayoutStore.closeRightDrawer()}
            />
          }
          headerContent={
            <Show when={currentFile()}>
              <MarkdownHeader
                fileName={currentFile()!.fileName}
                lastModified={currentFile()!.lastModified ? new Date(currentFile()!.lastModified!) : undefined}
                fileSize={currentFile()!.fileSize}
                activeTab={activeTab()}
                isOutlineOpen={mobileLayoutStore.rightDrawerOpen}
                outlineCount={extractedHeadings().length}
                content={currentFile()!.content}
                onTabChange={(tab) => setActiveTab(tab)}
                onOutlineToggle={handleMobileOutlineToggle}
              />
            </Show>
          }
        >
          <div class="mobile-main-content">
            <Show when={loading()}>
              <div class="loading">Loading...</div>
            </Show>

            <Show when={!loading() && !currentFile() && activeTab() === 'preview'}>
              <div class="welcome">
                <h1>OpenMKView</h1>
                <p>Tap the menu button to browse files</p>
              </div>
            </Show>

            <Show when={!loading() && currentFile() && activeTab() === 'preview'}>
              <div class="markdown-wrapper" style={getMarkdownStyle()}>
                <MarkdownView 
                  content={currentFile()!.content} 
                  onHeadingsExtracted={handleHeadingsExtracted} 
                />
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
                  mode="unified"
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
        </MobileLayout>
      </Show>

      {/* Shared overlays (rendered for both desktop and mobile) */}
      <SettingsPanel
        isOpen={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
      />

      <OpenProjectDialog
        isOpen={isOpenProjectDialogOpen()}
        onClose={handleCloseOpenProjectDialog}
        onProjectOpened={handleProjectOpened}
      />

      <Show when={colorPickerOpen()}>
        <div 
          style={{ 
            position: 'fixed', 
            top: `${colorPickerPosition().y}px`, 
            left: `${colorPickerPosition().x}px`,
            'z-index': '2000',
          }}
        >
          <ColorPicker
            currentColor={projects().find(p => p.id === colorPickerProjectId())?.color}
            onColorChange={handleColorChange}
            onClose={() => {
              setColorPickerOpen(false);
              setColorPickerProjectId(null);
            }}
          />
        </div>
      </Show>
    </>
  );
};

export default App;
