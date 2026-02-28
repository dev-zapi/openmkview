"use client";

import * as React from "react";
import { Menu, Plus, Sun, Moon, Monitor, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/lib/store";
import { buildProjectUrl } from "@/hooks/use-url-sync";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { OpenProjectDialog } from "@/components/activity-bar/open-project-dialog";
import { SettingsDialog } from "@/components/settings/settings-dialog";

export function MobileNav() {
  const {
    openProjects,
    activeProjectId,
    fileName,
    setSettingsDialogOpen,
  } = useAppStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isOpenProjectDialogOpen, setIsOpenProjectDialogOpen] = React.useState(false);

  // Listen for custom event from WelcomePage
  React.useEffect(() => {
    const handler = () => setIsOpenProjectDialogOpen(true);
    window.addEventListener("open-project-dialog", handler);
    return () => window.removeEventListener("open-project-dialog", handler);
  }, []);

  const handleProjectClick = (projectId: number) => {
    if (projectId !== activeProjectId) {
      router.push(buildProjectUrl(projectId));
    }
    setSidebarOpen(false);
  };

  const activeProject = openProjects.find((p) => p.id === activeProjectId);

  return (
    <>
      {/* Top navigation bar */}
      <div className="flex h-12 items-center justify-between border-b bg-muted/50 px-3 flex-shrink-0">
        {/* Left: Menu button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Center: Current context */}
        <div className="flex-1 min-w-0 mx-3 text-center">
          <span className="text-sm font-medium truncate block">
            {fileName ?? activeProject?.name ?? "OpenMKView"}
          </span>
        </div>

        {/* Right: Theme & Settings */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Toggle theme">
                {theme === "light" ? (
                  <Sun className="h-4 w-4" />
                ) : theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSettingsDialogOpen(true)}
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[300px] p-0 flex flex-col">
          <SheetHeader className="px-3 py-3 border-b">
            <SheetTitle className="text-base">Projects</SheetTitle>
          </SheetHeader>

          {/* Project tabs */}
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto flex-shrink-0 border-b">
            {openProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {project.name}
                </button>
              );
            })}
            <button
              onClick={() => setIsOpenProjectDialogOpen(true)}
              className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Open Project"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* File Explorer */}
          <div className="flex-1 overflow-hidden">
            <MobileFileExplorer onFileSelect={() => setSidebarOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <OpenProjectDialog
        open={isOpenProjectDialogOpen}
        onOpenChange={setIsOpenProjectDialogOpen}
      />

      <SettingsDialog />
    </>
  );
}

/**
 * Wraps FileExplorer to close the sheet when a file is selected on mobile.
 */
function MobileFileExplorer({ onFileSelect }: { onFileSelect: () => void }) {
  const selectedFilePath = useAppStore((s) => s.selectedFilePath);
  const prevPathRef = React.useRef(selectedFilePath);

  React.useEffect(() => {
    if (selectedFilePath && selectedFilePath !== prevPathRef.current) {
      onFileSelect();
    }
    prevPathRef.current = selectedFilePath;
  }, [selectedFilePath, onFileSelect]);

  return <FileExplorer />;
}
