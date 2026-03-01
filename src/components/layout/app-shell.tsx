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
import { MobileNav } from "@/components/layout/mobile-nav";
import { useAppStore } from "@/lib/store";
import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { useUrlSync } from "@/hooks/use-url-sync";
import { useIsMobile } from "@/hooks/use-mobile";

const DEFAULT_LAYOUT = { "file-explorer": 20, viewer: 80 };

export function AppShell() {
  const { activeProjectId, settings } = useAppStore(
    useShallow((state) => ({
      activeProjectId: state.activeProjectId,
      settings: state.settings,
    }))
  );
  const groupRef = useGroupRef();
  const isMobile = useIsMobile();

  // URL ↔ store synchronization (handles init, project/file loading)
  useUrlSync();

  // Apply UI font to CSS custom properties on document root
  useEffect(() => {
    const root = document.documentElement;
    const uiFont = settings.uiFont;
    if (uiFont?.fontFamily) {
      root.style.setProperty("--font-ui-custom", uiFont.fontFamily);
    } else {
      root.style.removeProperty("--font-ui-custom");
    }
    if (uiFont?.fontSize) {
      root.style.setProperty("--font-ui-size", uiFont.fontSize);
    } else {
      root.style.removeProperty("--font-ui-size");
    }

    const mdFont = settings.markdownFont;
    if (mdFont?.fontFamily) {
      root.style.setProperty("--font-md-custom", mdFont.fontFamily);
    } else {
      root.style.removeProperty("--font-md-custom");
    }
    if (mdFont?.fontSize) {
      root.style.setProperty("--font-md-size", mdFont.fontSize);
    } else {
      root.style.removeProperty("--font-md-size");
    }
  }, [settings.uiFont, settings.markdownFont]);

  // Ensure file explorer has proper width after Zustand hydration
  useEffect(() => {
    if (isMobile) return;
    const group = groupRef.current;
    if (!group || !activeProjectId) return;

    const currentLayout = group.getLayout();
    if (
      currentLayout["file-explorer"] === undefined ||
      currentLayout["file-explorer"] < 10
    ) {
      group.setLayout(DEFAULT_LAYOUT);
    }
  }, [activeProjectId, groupRef, isMobile]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex h-dvh w-screen flex-col overflow-hidden bg-background app-shell">
        <MobileNav />
        <div className="flex-1 overflow-hidden">
          <MarkdownViewer />
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-background app-shell">
      {/* Column 1: Activity Bar */}
      <ActivityBar />

      {/* Columns 2 + 3: Resizable panels */}
      <Group
        orientation="horizontal"
        className="flex-1"
        groupRef={groupRef}
        defaultLayout={DEFAULT_LAYOUT}
      >
        {/* Column 2: File Explorer */}
        <Panel
          minSize="15%"
          maxSize="40%"
          id="file-explorer"
        >
          <FileExplorer />
        </Panel>
        <Separator className="w-[3px] bg-border hover:bg-primary/50 transition-colors" />

        {/* Column 3: Markdown Viewer */}
        <Panel minSize="30%" id="viewer">
          <MarkdownViewer />
        </Panel>
      </Group>
    </div>
  );
}
