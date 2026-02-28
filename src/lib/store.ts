import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, ViewMode, FileTreeNode, HeadingInfo, SystemSettings } from "@/types";

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
            return null;
          }

          const project: Project = await res.json();
          await get().fetchProjects();
          return project;
        } catch (error) {
          console.error("Failed to open project:", error);
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
          const tree = await res.json();
          set({ fileTree: Array.isArray(tree) ? tree : [], isLoading: false });
        } catch (error) {
          console.error("Failed to fetch file tree:", error);
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
          const data = await res.json();
          set({
            fileContent: data.content || null,
            fileName: data.fileName || null,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to fetch file content:", error);
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
