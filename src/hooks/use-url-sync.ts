"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

function parsePathname(pathname: string): {
  projectId: number | null;
  filePath: string | null;
} {
  const match = pathname.match(/^\/project\/(\d+)(?:\/(.+))?$/);
  if (!match) return { projectId: null, filePath: null };
  return {
    projectId: parseInt(match[1], 10),
    filePath: match[2] ? decodeURIComponent(match[2]) : null,
  };
}

export function buildProjectUrl(projectId: number): string {
  return `/project/${projectId}`;
}

export function buildFileUrl(
  projectId: number,
  relativePath: string
): string {
  const encoded = relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `/project/${projectId}/${encoded}`;
}

export function useUrlSync() {
  const pathname = usePathname();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const syncingRef = useRef(false);

  // Fetch projects and settings on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await Promise.all([
        useAppStore.getState().fetchProjects(),
        useAppStore.getState().fetchSettings(),
      ]);
      if (!cancelled) setInitialized(true);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync URL → store when URL changes (after initialization)
  useEffect(() => {
    if (!initialized || syncingRef.current) return;

    const { projectId, filePath } = parsePathname(pathname);

    const sync = async () => {
      syncingRef.current = true;
      try {
        const state = useAppStore.getState();

        if (projectId === null) {
          // At home — redirect to first open project if available
          if (state.openProjects.length > 0) {
            router.replace(buildProjectUrl(state.openProjects[0].id));
            return;
          }
          // No projects — clear state
          useAppStore.setState({
            activeProjectId: null,
            selectedFilePath: null,
            fileContent: null,
            fileName: null,
            fileTree: [],
            headings: [],
          });
          return;
        }

        // Sync project
        if (state.activeProjectId !== projectId) {
          useAppStore.setState({
            activeProjectId: projectId,
            selectedFilePath: null,
            fileContent: null,
            fileName: null,
            headings: [],
          });
          await useAppStore.getState().fetchFileTree(projectId);
        }

        // Sync file
        const currentState = useAppStore.getState();
        if (filePath) {
          const project = currentState.openProjects.find(
            (p) => p.id === projectId
          );
          if (project) {
            const absolutePath = `${project.path}/${filePath}`;
            if (currentState.selectedFilePath !== absolutePath) {
              await currentState.fetchFileContent(absolutePath, projectId);
            }
          }
        } else if (currentState.selectedFilePath !== null) {
          useAppStore.setState({
            selectedFilePath: null,
            fileContent: null,
            fileName: null,
            headings: [],
          });
        }
      } finally {
        syncingRef.current = false;
      }
    };

    sync();
  }, [initialized, pathname, router]);

  // Navigation helpers
  const navigateToProject = useCallback(
    (id: number) => {
      router.push(buildProjectUrl(id));
    },
    [router]
  );

  const navigateToFile = useCallback(
    (projectId: number, relativePath: string) => {
      router.push(buildFileUrl(projectId, relativePath));
    },
    [router]
  );

  const navigateHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return {
    initialized,
    navigateToProject,
    navigateToFile,
    navigateHome,
  };
}
