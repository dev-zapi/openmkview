"use client";

import { FolderOpen } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function WelcomePage() {
  const [projectHistory, openProjects, openProject] = useAppStore((state) => [
    state.projectHistory,
    state.openProjects,
    state.openProject,
  ]);

  // Filter out projects that are already open from history
  const availableHistory = projectHistory.filter(
    (project) => !openProjects.some((p) => p.id === project.id)
  );

  const hasHistory = availableHistory.length > 0;

  const handleOpenProject = () => {
    // Trigger the open project dialog via custom event
    window.dispatchEvent(new CustomEvent("open-project-dialog"));
  };

  const handleOpenHistoryProject = async (path: string) => {
    await openProject(path);
  };

  // Abbreviate path for display (show last 2-3 segments)
  const abbreviatePath = (path: string): string => {
    const parts = path.split("/");
    if (parts.length <= 3) {
      return path;
    }
    return ".../" + parts.slice(-2).join("/");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScrollArea className="flex-1">
        <div className="flex min-h-full flex-col items-center justify-center p-8">
          {/* Title */}
          <h1 className="mb-8 text-4xl font-bold tracking-tight">OpenMKView</h1>

          {/* Main action */}
          <Button size="lg" onClick={handleOpenProject} className="gap-2">
            <FolderOpen className="h-5 w-5" />
            Open Project
          </Button>

          {/* Recent Projects section */}
          {hasHistory && (
            <div className="mt-12 w-full max-w-2xl">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Projects
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {availableHistory.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleOpenHistoryProject(project.path)}
                    className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent cursor-pointer"
                  >
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {abbreviatePath(project.path)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state message */}
          {!hasHistory && openProjects.length === 0 && (
            <p className="mt-8 text-center text-muted-foreground">
              Open a project to get started
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
