"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useShallow } from "zustand/shallow";
import { codeToHtml } from "shiki";
import { FileText, Eye, Code, List } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { processMarkdown, extractHeadings } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { WelcomePage } from "./welcome-page";
import { OutlinePanel, OutlinePanelContent } from "@/components/outline-panel/outline-panel";

export function MarkdownViewer() {
  const { theme, systemTheme } = useTheme();
  const {
    fileContent,
    fileName,
    viewMode,
    setViewMode,
    outlineVisible,
    toggleOutline,
    setHeadings,
    activeProjectId,
    openProjects,
    selectedFilePath,
    settings,
  } = useAppStore(
    useShallow((state) => ({
      fileContent: state.fileContent,
      fileName: state.fileName,
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      outlineVisible: state.outlineVisible,
      toggleOutline: state.toggleOutline,
      setHeadings: state.setHeadings,
      activeProjectId: state.activeProjectId,
      openProjects: state.openProjects,
      selectedFilePath: state.selectedFilePath,
      settings: state.settings,
    }))
  );

  const [processedContent, setProcessedContent] = useState<React.ReactElement | null>(null);
  const [highlightedSource, setHighlightedSource] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const currentTheme = theme === "system" ? systemTheme : theme;
  const shikiTheme = currentTheme === "dark" ? "github-dark" : "github-light";

  // Compute markdown content width style
  const markdownWidth = settings.markdownWidth;
  const contentWidthStyle: React.CSSProperties =
    markdownWidth.mode === "fixed"
      ? { maxWidth: markdownWidth.fixedWidth, marginLeft: "auto", marginRight: "auto" }
      : {};

  // Compute markdown font style
  const markdownFontStyle: React.CSSProperties = {};
  if (settings.markdownFont?.fontFamily) {
    markdownFontStyle.fontFamily = `${settings.markdownFont.fontFamily}, var(--font-geist-sans), sans-serif`;
  }
  if (settings.markdownFont?.fontSize) {
    markdownFontStyle.fontSize = settings.markdownFont.fontSize;
  }

  // Process markdown content when it changes
  const processContent = useCallback(async () => {
    if (!fileContent) {
      setProcessedContent(null);
      setHighlightedSource("");
      setHeadings([]);
      return;
    }

    setIsProcessing(true);

    try {
      // Extract headings for outline
      const headings = extractHeadings(fileContent);
      setHeadings(headings);

      // Process markdown for preview mode
      const { content } = await processMarkdown(fileContent);
      setProcessedContent(content);

      // Highlight source for source mode
      const highlighted = await codeToHtml(fileContent, {
        lang: "markdown",
        theme: shikiTheme,
      });
      setHighlightedSource(highlighted);
    } catch (error) {
      console.error("Failed to process markdown:", error);
      setProcessedContent(null);
      setHighlightedSource("");
    } finally {
      setIsProcessing(false);
    }
  }, [fileContent, shikiTheme, setHeadings]);

  useEffect(() => {
    processContent();
  }, [processContent]);

  // Re-highlight source when theme changes
  useEffect(() => {
    if (fileContent && viewMode === "source") {
      const rehighlight = async () => {
        try {
          const highlighted = await codeToHtml(fileContent, {
            lang: "markdown",
            theme: shikiTheme,
          });
          setHighlightedSource(highlighted);
        } catch (error) {
          console.error("Failed to re-highlight source:", error);
        }
      };
      rehighlight();
    }
  }, [shikiTheme, fileContent, viewMode]);

  // Show welcome page when no file is selected
  if (!fileContent || !fileName) {
    const hasOpenProjects = openProjects.length > 0;
    const hasActiveProject = activeProjectId !== null;

    // If a file is selected but content is still loading, show loading state
    if (selectedFilePath) {
      return (
        <div className="flex h-full flex-col bg-background">
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      );
    }

    // If there are open projects but no file selected, show a message
    if (hasOpenProjects && hasActiveProject) {
      return (
        <div className="flex h-full flex-col bg-background">
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <FileText className="h-16 w-16 opacity-50" />
              <p className="text-lg">Select a file from the sidebar</p>
            </div>
          </div>
        </div>
      );
    }

    // Otherwise show welcome page
    return <WelcomePage />;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-b px-2 sm:px-4">
        {/* Left: File name */}
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{fileName}</span>
        </div>

        {/* Center/Right: View mode toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("preview")}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button
            variant={viewMode === "source" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("source")}
            className="gap-1.5"
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
          </Button>

          <Separator orientation="vertical" className="mx-2 h-6" />

          {/* Outline toggle */}
          <Button
            variant={outlineVisible ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={toggleOutline}
            title="Toggle Outline"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-6">
            <div style={contentWidthStyle}>
              {isProcessing ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : viewMode === "preview" ? (
                /* Preview mode */
                <article className={`prose prose-neutral dark:prose-invert max-w-none overflow-x-hidden table-${settings.tableWidth ?? "full"}`} style={markdownFontStyle}>
                  {processedContent}
                </article>
              ) : (
                /* Source mode */
                <div
                  className="shiki-source"
                  dangerouslySetInnerHTML={{ __html: highlightedSource }}
                />
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Outline panel - desktop only (hidden on mobile) */}
        <div className="hidden md:block">
          <OutlinePanel />
        </div>

        {/* Outline Sheet - mobile only */}
        <Sheet open={outlineVisible} onOpenChange={(open) => !open && toggleOutline()}>
          <SheetContent side="right" className="w-[280px] p-0 md:hidden" showCloseButton={false}>
            <SheetTitle className="sr-only">Outline</SheetTitle>
            <OutlinePanelContent onClose={toggleOutline} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
