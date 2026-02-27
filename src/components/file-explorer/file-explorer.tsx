"use client";

import { Tree, NodeRendererProps } from "react-arborist";
import { useAppStore } from "@/lib/store";
import { FileTreeNode } from "@/types";
import {
  X,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";

function NodeRenderer({
  node,
  style,
  dragHandle,
}: NodeRendererProps<FileTreeNode>) {
  const { fetchFileContent, activeProjectId, selectedFilePath } = useAppStore();
  const Icon = node.data.isFolder
    ? node.isOpen
      ? FolderOpen
      : Folder
    : File;

  const isSelected = selectedFilePath === node.data.path;

  const handleClick = () => {
    if (node.data.isFolder) {
      node.toggle();
    } else {
      node.select();
      if (activeProjectId !== null) {
        fetchFileContent(node.data.path, activeProjectId);
      }
    }
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      onClick={handleClick}
      className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer ${
        isSelected ? "bg-accent" : "hover:bg-muted"
      }`}
    >
      {node.data.isFolder && (
        <span className="flex items-center justify-center w-4 h-4">
          {node.isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      )}
      {!node.data.isFolder && <span className="w-4" />}
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate select-none">{node.data.name}</span>
    </div>
  );
}

function getDisplayPath(fullPath: string): string {
  // Replace home directory with ~ for common patterns
  if (fullPath.startsWith("/home/")) {
    const parts = fullPath.split("/");
    if (parts.length >= 3) {
      return "~" + "/" + parts.slice(3).join("/");
    }
  }
  if (fullPath.startsWith("/Users/")) {
    const parts = fullPath.split("/");
    if (parts.length >= 3) {
      return "~" + "/" + parts.slice(3).join("/");
    }
  }
  return fullPath;
}

export function FileExplorer() {
  const {
    openProjects,
    activeProjectId,
    closeProject,
    fileTree,
  } = useAppStore();

  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeSize, setTreeSize] = useState({ width: 0, height: 0 });

  const updateSize = useCallback(() => {
    if (treeContainerRef.current) {
      const { width, height } = treeContainerRef.current.getBoundingClientRect();
      setTreeSize((prev) => {
        if (prev.width !== width || prev.height !== height) {
          return { width, height };
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [updateSize]);

  const activeProject = openProjects.find((p) => p.id === activeProjectId);

  if (!activeProject) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground">No project selected</p>
        </div>
      </div>
    );
  }

  const displayPath = getDisplayPath(activeProject.path);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">
              {activeProject.name}
            </h2>
            <p
              className="text-xs text-muted-foreground truncate"
              title={displayPath}
            >
              {displayPath}
            </p>
          </div>
          <button
            onClick={() => closeProject(activeProject.id)}
            className="flex-shrink-0 p-1 hover:bg-muted rounded-sm transition-colors"
            title="Close project"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div ref={treeContainerRef} className="flex-1 overflow-hidden">
        {treeSize.width > 0 && treeSize.height > 0 && (
          <Tree
            data={fileTree}
            idAccessor="id"
            rowHeight={28}
            indent={16}
            width={treeSize.width}
            height={treeSize.height}
          >
            {NodeRenderer}
          </Tree>
        )}
      </div>
    </div>
  );
}
