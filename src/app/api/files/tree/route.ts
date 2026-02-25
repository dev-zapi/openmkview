import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fg from "fast-glob";
import path from "path";
import type { FileTreeNode } from "@/types";

// GET /api/files/tree?projectId=... - Get file tree for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(parseInt(projectId, 10)) as { path: string } | undefined;

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const projectPath = project.path;

    // Use fast-glob to find markdown files
    const files = await fg(["**/*.md", "**/*.mdx"], {
      cwd: projectPath,
      ignore: ["node_modules/**", ".git/**"],
      dot: false,
      onlyFiles: true,
    });

    // Build tree from flat file paths
    const tree = buildTree(files, projectPath);

    return NextResponse.json(tree);
  } catch (error) {
    console.error("Failed to get file tree:", error);
    return NextResponse.json(
      { error: "Failed to get file tree" },
      { status: 500 }
    );
  }
}

function buildTree(filePaths: string[], rootPath: string): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const nodeMap = new Map<string, FileTreeNode>();

  // Sort paths to ensure parent directories are created before children
  const sortedPaths = [...filePaths].sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/");
    let currentChildren = root;

    for (let i = 0; i < parts.length; i++) {
      const partPath = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;

      let node = nodeMap.get(partPath);
      if (!node) {
        node = {
          id: partPath,
          name: parts[i],
          path: path.join(rootPath, partPath),
          isFolder: !isFile,
          children: isFile ? undefined : [],
        };
        nodeMap.set(partPath, node);
        currentChildren.push(node);
      }
      if (node.children) {
        currentChildren = node.children;
      }
    }
  }

  // Sort: folders first, then alphabetically
  sortTree(root);
  return root;
}

function sortTree(nodes: FileTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}
