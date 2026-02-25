import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

// GET /api/files/content?path=...&projectId=... - Read file content
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");
    const projectId = searchParams.get("projectId");

    if (!filePath || !projectId) {
      return NextResponse.json(
        { error: "path and projectId are required" },
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

    // Security: resolve and validate the path is within the project directory
    const resolvedFilePath = path.resolve(filePath);
    const resolvedProjectPath = path.resolve(project.path);

    if (!resolvedFilePath.startsWith(resolvedProjectPath + path.sep) &&
        resolvedFilePath !== resolvedProjectPath) {
      return NextResponse.json(
        { error: "Access denied: path is outside project directory" },
        { status: 403 }
      );
    }

    // Validate it's a markdown file
    const ext = path.extname(resolvedFilePath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") {
      return NextResponse.json(
        { error: "Only markdown files are supported" },
        { status: 400 }
      );
    }

    const content = await fs.readFile(resolvedFilePath, "utf-8");
    const fileName = path.basename(resolvedFilePath);

    return NextResponse.json({ content, fileName, path: resolvedFilePath });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
    console.error("Failed to read file:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}
