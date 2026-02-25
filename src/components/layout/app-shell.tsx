"use client";

import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import { ActivityBar } from "@/components/activity-bar/activity-bar";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { MarkdownViewer } from "@/components/markdown-viewer/markdown-viewer";
import { useAppStore } from "@/lib/store";
import { useEffect } from "react";

export function AppShell() {
  const { activeProjectId, fetchProjects, openProjects } = useAppStore();

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-switch to first open project if none is active
  useEffect(() => {
    if (!activeProjectId && openProjects.length > 0) {
      useAppStore.getState().switchProject(openProjects[0].id);
    }
  }, [activeProjectId, openProjects]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Column 1: Activity Bar */}
      <ActivityBar />

      {/* Columns 2 + 3: Resizable panels */}
      <Group orientation="horizontal" className="flex-1">
        {/* Column 2: File Explorer */}
        {activeProjectId && (
          <>
            <Panel
              defaultSize={20}
              minSize={15}
              maxSize={40}
              collapsible
              id="file-explorer"
            >
              <FileExplorer />
            </Panel>
            <Separator className="w-[3px] bg-border hover:bg-primary/50 transition-colors" />
          </>
        )}

        {/* Column 3: Markdown Viewer */}
        <Panel defaultSize={80} minSize={30} id="viewer">
          <MarkdownViewer />
        </Panel>
      </Group>
    </div>
  );
}
