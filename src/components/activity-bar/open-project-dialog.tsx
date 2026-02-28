"use client";

import * as React from "react";
import { FolderOpen, History } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/lib/store";
import { buildProjectUrl } from "@/hooks/use-url-sync";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface DirectoryResult {
  name: string;
  path: string;
  display: string;
  isRecent?: boolean;
}

interface OpenProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenProjectDialog({ open, onOpenChange }: OpenProjectDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<DirectoryResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const handleOpenProject = async (path: string) => {
    const project = await useAppStore.getState().openProject(path);
    onOpenChange(false);
    setSearchQuery("");
    setResults([]);
    if (project) {
      router.push(buildProjectUrl(project.id));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && results.length > 0) {
      e.preventDefault();
      // 获取当前选中项的 data-value（即 path）
      const selectedEl = document.querySelector(
        "[cmdk-item][data-selected='true']"
      );
      const selectedPath = selectedEl?.getAttribute("data-value");
      if (!selectedPath) return;

      const match = results.find(
        (r) => r.path.toLowerCase() === selectedPath.toLowerCase()
      );
      if (!match) return;

      // 将 display 路径转为输入框格式，并追加 / 以便继续浏览
      let fillValue = match.display;
      if (fillValue.startsWith("~/")) {
        fillValue = fillValue.slice(2);
      }
      if (!fillValue.endsWith("/")) {
        fillValue += "/";
      }
      setSearchQuery(fillValue);
      return;
    }

    if (e.key === "Enter" && searchQuery.trim()) {
      // If there are no results, treat the typed value as a direct path
      if (results.length === 0) {
        e.preventDefault();
        handleOpenProject(searchQuery.trim());
      }
    }
  };

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    timeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/directories/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setResults(Array.isArray(data) ? data : []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("Failed to search directories:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchQuery]);

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setResults([]);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Open Project"
      description="Search for a directory to open as a project"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search directories or type a path..."
        value={searchQuery}
        onValueChange={setSearchQuery}
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        ) : results.length === 0 && searchQuery.trim() ? (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <p>No directories found.</p>
              <p className="text-xs text-muted-foreground">
                Press Enter to open &quot;{searchQuery}&quot; directly
              </p>
            </div>
          </CommandEmpty>
        ) : (
          <>
            {results.some((r) => r.isRecent) && (
              <CommandGroup heading="Recent Projects">
                {results
                  .filter((r) => r.isRecent)
                  .map((result) => (
                    <CommandItem
                      key={result.path}
                      value={result.path}
                      onSelect={() => handleOpenProject(result.path)}
                    >
                      <History className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate">{result.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {result.display}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
            {results.some((r) => !r.isRecent) && (
              <CommandGroup heading="Directories">
                {results
                  .filter((r) => !r.isRecent)
                  .map((result) => (
                    <CommandItem
                      key={result.path}
                      value={result.path}
                      onSelect={() => handleOpenProject(result.path)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate">{result.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {result.display}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
