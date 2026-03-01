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
import {
  GitBranch,
  Plus,
  Check,
  Upload,
  RefreshCw,
  FileEdit,
  FilePlus,
  FileX,
  FileQuestion,
  Loader2,
  Download,
  History,
  Terminal,
} from "lucide-react";
import type { GitFileStatus } from "@/types";

function StatusIcon({ status }: { status: GitFileStatus }) {
  const code = status.workTree !== " " ? status.workTree : status.index;
  switch (code) {
    case "M":
      return <FileEdit className="w-4 h-4 text-yellow-500" />;
    case "A":
      return <FilePlus className="w-4 h-4 text-green-500" />;
    case "D":
      return <FileX className="w-4 h-4 text-red-500" />;
    case "?":
      return <FileQuestion className="w-4 h-4 text-muted-foreground" />;
    default:
      return <FileEdit className="w-4 h-4 text-muted-foreground" />;
  }
}

function statusLabel(status: GitFileStatus): string {
  const code = status.workTree !== " " ? status.workTree : status.index;
  switch (code) {
    case "M": return "Modified";
    case "A": return "Added";
    case "D": return "Deleted";
    case "R": return "Renamed";
    case "?": return "Untracked";
    default: return code;
  }
}

function isStaged(status: GitFileStatus): boolean {
  return status.index !== " " && status.index !== "?";
}

export function GitPanel() {
  const {
    gitStatus,
    gitPanelOpen,
    setGitPanelOpen,
    activeProjectId,
    fetchGitStatus,
    gitAdd,
    gitCommit,
    gitPush,
    gitPull,
    gitPullRebase,
    gitFetch,
    gitLog,
    setGitLogDialogOpen,
    setGitCommandDialogOpen,
  } = useAppStore(
    useShallow((state) => ({
      gitStatus: state.gitStatus,
      gitPanelOpen: state.gitPanelOpen,
      setGitPanelOpen: state.setGitPanelOpen,
      activeProjectId: state.activeProjectId,
      fetchGitStatus: state.fetchGitStatus,
      gitAdd: state.gitAdd,
      gitCommit: state.gitCommit,
      gitPush: state.gitPush,
      gitPull: state.gitPull,
      gitPullRebase: state.gitPullRebase,
      gitFetch: state.gitFetch,
      gitLog: state.gitLog,
      setGitLogDialogOpen: state.setGitLogDialogOpen,
      setGitCommandDialogOpen: state.setGitCommandDialogOpen,
    }))
  );

  const [commitMessage, setCommitMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Fetch status when panel opens
  React.useEffect(() => {
    if (gitPanelOpen && activeProjectId) {
      fetchGitStatus(activeProjectId);
    }
  }, [gitPanelOpen, activeProjectId, fetchGitStatus]);

  const handleRefresh = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError("");
    try {
      await fetchGitStatus(activeProjectId);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAll = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError("");
    try {
      await gitAdd(activeProjectId);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFile = async (filePath: string) => {
    if (!activeProjectId) return;
    setError("");
    await gitAdd(activeProjectId, [filePath]);
  };

  const handleCommit = async () => {
    if (!activeProjectId || !commitMessage.trim()) return;
    setLoading(true);
    setError("");
    try {
      await gitCommit(activeProjectId, commitMessage.trim());
      setCommitMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError("");
    try {
      await gitPush(activeProjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Push failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError("");
    try {
      await gitPull(activeProjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePullRebase = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError("");
    try {
      await gitPullRebase(activeProjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull --rebase failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError("");
    try {
      await gitFetch(activeProjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const handleShowLog = async () => {
    if (!activeProjectId) return;
    await gitLog(activeProjectId);
    setGitLogDialogOpen(true);
  };

  const handleShowCommand = () => {
    setGitCommandDialogOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
  };

  const stagedFiles = gitStatus?.files.filter(isStaged) ?? [];
  const unstagedFiles = gitStatus?.files.filter((f) => !isStaged(f)) ?? [];

  return (
    <Dialog open={gitPanelOpen} onOpenChange={setGitPanelOpen}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Git
            {gitStatus?.isRepo && gitStatus.branch && (
              <span className="text-sm font-normal text-muted-foreground">
                ({gitStatus.branch})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Manage Git operations for the current project
          </DialogDescription>
        </DialogHeader>

        {!activeProjectId ? (
          <p className="text-sm text-muted-foreground py-4">No project selected</p>
        ) : gitStatus && !gitStatus.isRepo ? (
          <p className="text-sm text-muted-foreground py-4">
            This project is not a Git repository
          </p>
        ) : (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Refresh status"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Status
              </button>
              <button
                onClick={handleAddAll}
                disabled={loading || unstagedFiles.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Stage all changes"
              >
                <Plus className="w-4 h-4" />
                Add All
              </button>
              <button
                onClick={handlePush}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Push to remote"
              >
                <Upload className="w-4 h-4" />
                Push
              </button>
              <button
                onClick={handlePull}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Pull from remote"
              >
                <Download className="w-4 h-4" />
                Pull
              </button>
              <button
                onClick={handlePullRebase}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Pull with rebase"
              >
                <Download className="w-4 h-4" />
                Rebase
              </button>
              <button
                onClick={handleFetch}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Fetch from remote"
              >
                <RefreshCw className="w-4 h-4" />
                Fetch
              </button>
              <button
                onClick={handleShowLog}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="View commit history"
              >
                <History className="w-4 h-4" />
                Log
              </button>
              <button
                onClick={handleShowCommand}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="Run git command"
              >
                <Terminal className="w-4 h-4" />
                Command
              </button>
            </div>

            {/* Commit Input */}
            <div className="flex gap-2">
              <Input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Commit message..."
                className="flex-1"
              />
              <button
                onClick={handleCommit}
                disabled={loading || !commitMessage.trim() || stagedFiles.length === 0}
                className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Commit staged changes"
              >
                <Check className="w-4 h-4" />
                Commit
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            {/* File Lists */}
            <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
              {/* Staged */}
              {stagedFiles.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Staged ({stagedFiles.length})
                  </h4>
                  <div className="space-y-0.5">
                    {stagedFiles.map((file) => (
                      <div
                        key={`staged-${file.path}`}
                        className="flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-muted"
                      >
                        <StatusIcon status={file} />
                        <span className="truncate flex-1" title={file.path}>
                          {file.path}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {statusLabel(file)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unstaged */}
              {unstagedFiles.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Changes ({unstagedFiles.length})
                  </h4>
                  <div className="space-y-0.5">
                    {unstagedFiles.map((file) => (
                      <div
                        key={`unstaged-${file.path}`}
                        className="flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-muted group"
                      >
                        <StatusIcon status={file} />
                        <span className="truncate flex-1" title={file.path}>
                          {file.path}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {statusLabel(file)}
                        </span>
                        <button
                          onClick={() => handleAddFile(file.path)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
                          title="Stage file"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stagedFiles.length === 0 && unstagedFiles.length === 0 && gitStatus?.isRepo && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Working tree clean
                </p>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
