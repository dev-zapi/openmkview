"use client";

import * as React from "react";
import { Plus, Sun, Moon, Monitor, Settings } from "lucide-react";
import { useTheme } from "next-themes";

import { useAppStore } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { OpenProjectDialog } from "./open-project-dialog";

export function ActivityBar() {
  const { openProjects, activeProjectId, switchProject } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [isOpenProjectDialogOpen, setIsOpenProjectDialogOpen] = React.useState(false);

  // Listen for custom event from WelcomePage
  React.useEffect(() => {
    const handler = () => setIsOpenProjectDialogOpen(true);
    window.addEventListener("open-project-dialog", handler);
    return () => window.removeEventListener("open-project-dialog", handler);
  }, []);

  const handleProjectClick = (projectId: number) => {
    if (projectId !== activeProjectId) {
      switchProject(projectId);
    }
  };

  const handleOpenProject = () => {
    setIsOpenProjectDialogOpen(true);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="flex h-full w-12 flex-col items-center gap-1 border-r bg-muted/50 py-2">
        {/* Project List */}
        <div className="flex w-full flex-col items-center gap-1 px-1">
          {openProjects.map((project) => {
            const isActive = project.id === activeProjectId;
            const initial = project.name.charAt(0).toUpperCase();

            return (
              <Tooltip key={project.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleProjectClick(project.id)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {initial}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{project.name}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Open Project Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleOpenProject}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Open Project"
            >
              <Plus className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Open Project</p>
          </TooltipContent>
        </Tooltip>

        {/* Spacer to push bottom items down */}
        <div className="flex-1" />

        <Separator className="w-8" />

        {/* Theme Toggle */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  aria-label="Toggle theme"
                >
                  {theme === "light" ? (
                    <Sun className="h-5 w-5" />
                  ) : theme === "dark" ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Monitor className="h-5 w-5" />
                  )}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Toggle theme</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              <span>Light</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              <span>System</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Settings coming soon</p>
          </TooltipContent>
        </Tooltip>
      </aside>

      <OpenProjectDialog
        open={isOpenProjectDialogOpen}
        onOpenChange={setIsOpenProjectDialogOpen}
      />
    </TooltipProvider>
  );
}
