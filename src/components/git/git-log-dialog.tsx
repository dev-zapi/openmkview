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
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User, Calendar } from "lucide-react";

export function GitLogDialog() {
  const {
    gitLogEntries,
    gitLogDialogOpen,
    setGitLogDialogOpen,
    activeProjectId,
    gitShow,
    setGitDiffDialogOpen,
  } = useAppStore(
    useShallow((state) => ({
      gitLogEntries: state.gitLogEntries,
      gitLogDialogOpen: state.gitLogDialogOpen,
      setGitLogDialogOpen: state.setGitLogDialogOpen,
      activeProjectId: state.activeProjectId,
      gitShow: state.gitShow,
      setGitDiffDialogOpen: state.setGitDiffDialogOpen,
    }))
  );

  const handleCommitClick = async (hash: string) => {
    if (!activeProjectId) return;
    await gitShow(activeProjectId, hash);
    setGitDiffDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={gitLogDialogOpen} onOpenChange={setGitLogDialogOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Commit History
          </DialogTitle>
          <DialogDescription>
            Click on a commit to view its changes
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
          <div className="space-y-2 pr-4">
            {gitLogEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No commits found
              </p>
            ) : (
              gitLogEntries.map((entry) => (
                <div
                  key={entry.hash}
                  onClick={() => handleCommitClick(entry.hash)}
                  className="p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-16 font-mono text-xs text-primary">
                      {entry.shortHash}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.message}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.authorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(entry.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
