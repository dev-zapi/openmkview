"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

// Dynamically import to avoid SSR issues
const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
});

interface InlineDiffViewerProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
  splitView?: boolean;
}

export function InlineDiffViewer({
  oldContent,
  newContent,
  oldTitle = "HEAD",
  newTitle = "Working Tree",
  splitView = true,
}: InlineDiffViewerProps) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const useDarkTheme = currentTheme === "dark";

  if (oldContent === newContent) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No changes to display
      </p>
    );
  }

  return (
    <div className="diff-viewer-wrapper overflow-x-auto">
      <ReactDiffViewer
        oldValue={oldContent}
        newValue={newContent}
        splitView={splitView}
        useDarkTheme={useDarkTheme}
        leftTitle={oldTitle}
        rightTitle={newTitle}
        showDiffOnly={false}
        styles={{
          variables: {
            light: {
              diffViewerBackground: "transparent",
              addedBackground: "rgb(187 247 208 / 0.3)",
              addedColor: "rgb(21 128 61)",
              removedBackground: "rgb(254 202 202 / 0.3)",
              removedColor: "rgb(185 28 28)",
              wordAddedBackground: "rgb(134 239 172 / 0.5)",
              wordRemovedBackground: "rgb(252 165 165 / 0.5)",
              addedGutterBackground: "rgb(187 247 208 / 0.5)",
              removedGutterBackground: "rgb(254 202 202 / 0.5)",
              gutterBackground: "rgb(250 250 250)",
              gutterBackgroundDark: "rgb(245 245 245)",
              highlightBackground: "rgb(255 251 235)",
              highlightGutterBackground: "rgb(255 251 235)",
              codeFoldGutterBackground: "rgb(245 245 245)",
              codeFoldBackground: "rgb(250 250 250)",
              emptyLineBackground: "rgb(250 250 250)",
            },
            dark: {
              diffViewerBackground: "transparent",
              addedBackground: "rgb(22 101 52 / 0.3)",
              addedColor: "rgb(134 239 172)",
              removedBackground: "rgb(127 29 29 / 0.3)",
              removedColor: "rgb(252 165 165)",
              wordAddedBackground: "rgb(22 163 74 / 0.4)",
              wordRemovedBackground: "rgb(220 38 38 / 0.4)",
              addedGutterBackground: "rgb(22 101 52 / 0.4)",
              removedGutterBackground: "rgb(127 29 29 / 0.4)",
              gutterBackground: "rgb(30 30 30)",
              gutterBackgroundDark: "rgb(25 25 25)",
              highlightBackground: "rgb(66 32 6)",
              highlightGutterBackground: "rgb(66 32 6)",
              codeFoldGutterBackground: "rgb(30 30 30)",
              codeFoldBackground: "rgb(35 35 35)",
              emptyLineBackground: "rgb(30 30 30)",
            },
          },
          contentText: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "13px",
            lineHeight: "1.5",
          },
          gutter: {
            minWidth: "40px",
            padding: "0 8px",
          },
          line: {
            padding: "0 8px",
          },
          titleBlock: {
            padding: "8px 12px",
            fontWeight: 600,
            fontSize: "12px",
            borderBottom: useDarkTheme ? "1px solid rgb(63 63 70)" : "1px solid rgb(228 228 231)",
          },
        }}
      />
    </div>
  );
}
