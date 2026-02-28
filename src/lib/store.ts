import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { Project, ViewMode, FileTreeNode, HeadingInfo, SystemSettings, GitStatus } from "@/types";

interface AppState {
  // Projects
  openProjects: Project[];
  activeProjectId: number | null;
  projectHistory: Project[];

  // Files
  fileTree: FileTreeNode[];
  selectedFilePath: string | null;
  fileContent: string | null;
  fileName: string | null;

  // Viewer
  viewMode: ViewMode;
  outlineVisible: boolean;
  headings: HeadingInfo[];

  // UI State
  isLoading: boolean;

  // Settings
  settings: SystemSettings;
  settingsDialogOpen: boolean;

  // Git
  gitStatus: GitStatus | null;
  gitPanelOpen: boolean;

  // Actions
  setOpenProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: number | null) => void;
  setProjectHistory: (projects: Project[]) => void;
  setFileTree: (tree: FileTreeNode[]) => void;
  setSelectedFilePath: (path: string | null) => void;
  setFileContent: (content: string | null, fileName: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleOutline: () => void;
  setHeadings: (headings: HeadingInfo[]) => void;
  setIsLoading: (loading: boolean) => void;

  // Git actions
  setGitPanelOpen: (open: boolean) => void;
  fetchGitStatus: (projectId: number) => Promise<void>;
  gitAdd: (projectId: number, files?: string[]) => Promise<void>;
  gitCommit: (projectId: number, message: string) => Promise<void>;
  gitPush: (projectId: number) => Promise<void>;

  // Complex actions
  fetchProjects: () => Promise<void>;
  openProject: (path: string) => Promise<Project | null>;
  closeProject: (id: number) => Promise<void>;
  switchProject: (id: number) => Promise<void>;
  fetchFileTree: (projectId: number) => Promise<void>;
  fetchFileContent: (filePath: string, projectId: number) => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  setSettingsDialogOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      openProjects: [],
      activeProjectId: null,
      projectHistory: [],
      fileTree: [],
      selectedFilePath: null,
      fileContent: null,
      fileName: null,
      viewMode: "preview",
      outlineVisible: false,
      headings: [],
      isLoading: false,
      settings: {
        markdownWidth: { mode: "full", fixedWidth: "70%" },
        uiFont: { fontFamily: "", fontSize: "14px" },
        markdownFont: { fontFamily: "", fontSize: "16px" },
        tableWidth: "full",
      },
      settingsDialogOpen: false,
      gitStatus: null,
      gitPanelOpen: false,

      // Simple setters
      setOpenProjects: (projects) => set({ openProjects: projects }),
      setActiveProjectId: (id) => set({ activeProjectId: id }),
      setProjectHistory: (projects) => set({ projectHistory: projects }),
      setFileTree: (tree) => set({ fileTree: tree }),
      setSelectedFilePath: (path) => set({ selectedFilePath: path }),
      setFileContent: (content, fileName) => set({ fileContent: content, fileName }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleOutline: () => set((s) => ({ outlineVisible: !s.outlineVisible })),
      setHeadings: (headings) => set({ headings }),
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Git
      setGitPanelOpen: (open) => set({ gitPanelOpen: open }),

      fetchGitStatus: async (projectId) => {
        try {
          const res = await fetch("/api/git", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", projectId }),
          });
          if (res.ok) {
            const status = await res.json();
            set({ gitStatus: status });
          }
        } catch (error) {
          console.error("Failed to fetch git status:", error);
        }
      },

      gitAdd: async (projectId, files) => {
        try {
          const res = await fetch("/api/git", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add", projectId, files }),
          });
          if (res.ok) {
            const status = await res.json();
            set({ gitStatus: status });
          }
        } catch (error) {
          console.error("Failed to git add:", error);
        }
      },

      gitCommit: async (projectId, message) => {
        try {
          const res = await fetch("/api/git", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "commit", projectId, message }),
          });
          if (res.ok) {
            const status = await res.json();
            set({ gitStatus: status });
          } else {
            const err = await res.json();
            throw new Error(err.error);
          }
        } catch (error) {
          console.error("Failed to git commit:", error);
          throw error;
        }
      },

      gitPush: async (projectId) => {
        try {
          const res = await fetch("/api/git", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "push", projectId }),
          });
          if (res.ok) {
            const status = await res.json();
            set({ gitStatus: status });
          } else {
            const err = await res.json();
            throw new Error(err.error);
          }
        } catch (error) {
          console.error("Failed to git push:", error);
          throw error;
        }
      },

      // Fetch all projects
      fetchProjects: async () => {
        try {
          const [openRes, allRes] = await Promise.all([
            fetch("/api/projects?open=true"),
            fetch("/api/projects"),
          ]);
          const openProjects = await openRes.json();
          const allProjects = await allRes.json();

          set({
            openProjects: Array.isArray(openProjects) ? openProjects : [],
            projectHistory: Array.isArray(allProjects)
              ? allProjects.filter((p: Project) => !p.is_open)
              : [],
          });
        } catch (error) {
          console.error("Failed to fetch projects:", error);
          toast.error("获取项目列表失败");
        }
      },

      // Open a new project (returns project; caller handles navigation)
      openProject: async (dirPath: string) => {
        try {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: dirPath }),
          });

          if (!res.ok) {
            const error = await res.json();
            console.error("Failed to open project:", error);
            toast.error("打开项目失败", { description: error.error || "未知错误" });
            return null;
          }

          const project: Project = await res.json();
          await get().fetchProjects();
          return project;
        } catch (error) {
          console.error("Failed to open project:", error);
          toast.error("打开项目失败", { description: "无法连接到服务器" });
          return null;
        }
      },

      // Close a project (caller handles navigation)
      closeProject: async (id: number) => {
        try {
          await fetch(`/api/projects/${id}`, { method: "DELETE" });
          await get().fetchProjects();
        } catch (error) {
          console.error("Failed to close project:", error);
          toast.error("关闭项目失败");
        }
      },

      // Switch to a project
      switchProject: async (id: number) => {
        set({
          activeProjectId: id,
          selectedFilePath: null,
          fileContent: null,
          fileName: null,
          headings: [],
        });
        await get().fetchFileTree(id);
      },

      // Fetch file tree for a project
      fetchFileTree: async (projectId: number) => {
        try {
          set({ isLoading: true });
          const res = await fetch(`/api/files/tree?projectId=${projectId}`);
          if (!res.ok) {
            const error = await res.json();
            toast.error("加载文件树失败", { description: error.error || "未知错误" });
            set({ fileTree: [], isLoading: false });
            return;
          }
          const tree = await res.json();
          set({ fileTree: Array.isArray(tree) ? tree : [], isLoading: false });
        } catch (error) {
          console.error("Failed to fetch file tree:", error);
          toast.error("加载文件树失败");
          set({ fileTree: [], isLoading: false });
        }
      },

      // Fetch file content
      fetchFileContent: async (filePath: string, projectId: number) => {
        try {
          set({ isLoading: true, selectedFilePath: filePath });
          const res = await fetch(
            `/api/files/content?path=${encodeURIComponent(filePath)}&projectId=${projectId}`
          );
          if (!res.ok) {
            const error = await res.json();
            toast.error("读取文件失败", { description: error.error || "未知错误" });
            set({ fileContent: null, fileName: null, isLoading: false });
            return;
          }
          const data = await res.json();
          set({
            fileContent: data.content || null,
            fileName: data.fileName || null,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to fetch file content:", error);
          toast.error("读取文件失败");
          set({ fileContent: null, fileName: null, isLoading: false });
        }
      },

      // Settings
      setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),

      fetchSettings: async () => {
        try {
          const res = await fetch("/api/settings");
          if (res.ok) {
            const settings = await res.json();
            set({ settings });
          }
        } catch (error) {
          console.error("Failed to fetch settings:", error);
        }
      },

      updateSettings: async (partial) => {
        try {
          const current = get().settings;
          const updated = { ...current, ...partial };
          const res = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });
          if (res.ok) {
            const settings = await res.json();
            set({ settings });
          } else {
            const error = await res.json();
            toast.error("保存设置失败", { description: error.error || "未知错误" });
          }
        } catch (error) {
          console.error("Failed to update settings:", error);
        }
      },
    }),
    {
      name: "openmkview-storage",
      partialize: (state) => ({
        viewMode: state.viewMode,
        outlineVisible: state.outlineVisible,
      }),
    }
  )
);
