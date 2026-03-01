"use client";

import * as React from "react";
import { useShallow } from "zustand/shallow";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Play, Loader2 } from "lucide-react";

export function GitCommandDialog() {
  const {
    gitCommandDialogOpen,
    setGitCommandDialogOpen,
    gitCommandOutput,
    setGitCommandOutput,
    activeProjectId,
    gitExec,
  } = useAppStore(
    useShallow((state) => ({
      gitCommandDialogOpen: state.gitCommandDialogOpen,
      setGitCommandDialogOpen: state.setGitCommandDialogOpen,
      gitCommandOutput: state.gitCommandOutput,
      setGitCommandOutput: state.setGitCommandOutput,
      activeProjectId: state.activeProjectId,
      gitExec: state.gitExec,
    }))
  );

  const [command, setCommand] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleRun = async () => {
    if (!activeProjectId || !command.trim()) return;
    setLoading(true);
    setError("");
    try {
      const output = await gitExec(activeProjectId, command.trim());
      setGitCommandOutput(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
      setGitCommandOutput("");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  const handleOpenChange = (open: boolean) => {
    setGitCommandDialogOpen(open);
    if (!open) {
      setCommand("");
      setGitCommandOutput("");
      setError("");
    }
  };

  return (
    <Dialog open={gitCommandDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Run Git Command
          </DialogTitle>
          <DialogDescription>
            Enter a git subcommand (without &quot;git&quot; prefix)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Command Input */}
          <div className="flex gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted text-sm text-muted-foreground">
              git
            </div>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="status, log -5, branch -a, ..."
              className="flex-1 font-mono"
              autoFocus
            />
            <button
              onClick={handleRun}
              disabled={loading || !command.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Output */}
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            <div className="p-3 bg-muted/50 rounded-md min-h-[200px]">
              {gitCommandOutput ? (
                <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                  {gitCommandOutput}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Output will appear here
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
