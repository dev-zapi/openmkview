"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { parseDiffFromFile, type FileContents, type DiffsThemeNames } from "@pierre/diffs";

// Dynamically import to avoid SSR issues
const FileDiff = dynamic(
  () => import("@pierre/diffs/react").then((mod) => ({ default: mod.FileDiff })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);

interface InlineDiffViewerProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
  fileName?: string;
}

export function InlineDiffViewer({
  oldContent,
  newContent,
  fileName = "file.md",
}: InlineDiffViewerProps) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const useDarkTheme = currentTheme === "dark";

  // Normalize line endings to LF to avoid false positives from CRLF differences
  const normalizedOld = oldContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const normalizedNew = newContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const fileDiff = useMemo(() => {
    if (normalizedOld === normalizedNew) {
      return null;
    }
    const oldFile: FileContents = {
      name: fileName,
      contents: normalizedOld,
    };
    const newFile: FileContents = {
      name: fileName,
      contents: normalizedNew,
    };
    return parseDiffFromFile(oldFile, newFile);
  }, [normalizedOld, normalizedNew, fileName]);

  if (!fileDiff) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No changes to display
      </p>
    );
  }

  return (
    <div className="diff-viewer-wrapper overflow-x-auto rounded-md border">
      <FileDiff
        fileDiff={fileDiff}
        options={{
          theme: (useDarkTheme ? "pierre-dark" : "pierre-light") as DiffsThemeNames,
        }}
      />
    </div>
  );
}
