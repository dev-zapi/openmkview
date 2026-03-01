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
import { FileDiff } from "lucide-react";

function DiffLine({ line, index }: { line: string; index: number }) {
  let className = "font-mono text-xs whitespace-pre";
  if (line.startsWith("+") && !line.startsWith("+++")) {
    className += " bg-green-500/20 text-green-700 dark:text-green-400";
  } else if (line.startsWith("-") && !line.startsWith("---")) {
    className += " bg-red-500/20 text-red-700 dark:text-red-400";
  } else if (line.startsWith("@@")) {
    className += " bg-blue-500/20 text-blue-700 dark:text-blue-400";
  } else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
    className += " text-muted-foreground";
  }

  return (
    <div key={index} className={className}>
      {line || " "}
    </div>
  );
}

export function GitDiffDialog() {
  const {
    gitDiffContent,
    gitDiffDialogOpen,
    setGitDiffDialogOpen,
    gitDiffTitle,
  } = useAppStore(
    useShallow((state) => ({
      gitDiffContent: state.gitDiffContent,
      gitDiffDialogOpen: state.gitDiffDialogOpen,
      setGitDiffDialogOpen: state.setGitDiffDialogOpen,
      gitDiffTitle: state.gitDiffTitle,
    }))
  );

  const lines = gitDiffContent.split("\n");

  return (
    <Dialog open={gitDiffDialogOpen} onOpenChange={setGitDiffDialogOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDiff className="w-5 h-5" />
            {gitDiffTitle || "Diff"}
          </DialogTitle>
          <DialogDescription>
            View file changes
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[65vh]">
          <div className="p-2 bg-muted/50 rounded-md">
            {gitDiffContent.trim() === "" ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No changes
              </p>
            ) : (
              lines.map((line, i) => <DiffLine key={i} line={line} index={i} />)
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
