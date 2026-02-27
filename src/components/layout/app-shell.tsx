"use client";

import {
  Panel,
  Group,
  Separator,
  useGroupRef,
} from "react-resizable-panels";
import { ActivityBar } from "@/components/activity-bar/activity-bar";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { MarkdownViewer } from "@/components/markdown-viewer/markdown-viewer";
import { useAppStore } from "@/lib/store";
import { useEffect } from "react";

const LAYOUT_WITH_EXPLORER = { "file-explorer": 20, viewer: 80 };
const LAYOUT_WITHOUT_EXPLORER = { "file-explorer": 0, viewer: 100 };

export function AppShell() {
  const { activeProjectId, fetchProjects, openProjects } = useAppStore();
  const groupRef = useGroupRef();

  // Load projects on mount and restore persisted state
  useEffect(() => {
    const init = async () => {
      await fetchProjects();

      const state = useAppStore.getState();
      // If we have a persisted active project, restore file tree and content
      if (state.activeProjectId) {
        await state.fetchFileTree(state.activeProjectId);

        if (state.selectedFilePath) {
          await state.fetchFileContent(
            state.selectedFilePath,
            state.activeProjectId
          );
        }
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch to first open project if none is active
  useEffect(() => {
    if (!activeProjectId && openProjects.length > 0) {
      useAppStore.getState().switchProject(openProjects[0].id);
    }
  }, [activeProjectId, openProjects]);

  // Force correct layout when activeProjectId changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (activeProjectId) {
      const currentLayout = group.getLayout();
      // Only force layout if file explorer is too small (collapsed or near-zero)
      if (
        currentLayout["file-explorer"] === undefined ||
        currentLayout["file-explorer"] < 10
      ) {
        group.setLayout(LAYOUT_WITH_EXPLORER);
      }
    } else {
      group.setLayout(LAYOUT_WITHOUT_EXPLORER);
    }
  }, [activeProjectId, groupRef]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Column 1: Activity Bar */}
      <ActivityBar />

      {/* Columns 2 + 3: Resizable panels */}
      <Group
        orientation="horizontal"
        className="flex-1"
        groupRef={groupRef}
        defaultLayout={LAYOUT_WITH_EXPLORER}
      >
        {/* Column 2: File Explorer - always rendered, collapsed when no project */}
        <Panel
          minSize={0}
          maxSize={40}
          collapsible
          collapsedSize={0}
          id="file-explorer"
        >
          <FileExplorer />
        </Panel>
        <Separator className="w-[3px] bg-border hover:bg-primary/50 transition-colors" />

        {/* Column 3: Markdown Viewer */}
        <Panel minSize={30} id="viewer">
          <MarkdownViewer />
        </Panel>
      </Group>
    </div>
  );
}
