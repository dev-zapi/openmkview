import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fs from "fs";
import path from "path";

// GET /api/projects - List all projects
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const openOnly = searchParams.get("open") === "true";

    let projects;
    if (openOnly) {
      projects = db
        .prepare("SELECT * FROM projects WHERE is_open = 1 ORDER BY last_opened_at DESC")
        .all();
    } else {
      projects = db
        .prepare("SELECT * FROM projects ORDER BY last_opened_at DESC")
        .all();
    }

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Add/open a project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dirPath = body.path;

    if (!dirPath || typeof dirPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    // Resolve and validate path
    const resolvedPath = path.resolve(dirPath);

    // Check if directory exists
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: "Directory does not exist" },
        { status: 400 }
      );
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const db = getDb();
    const name = path.basename(resolvedPath);

    // Upsert: insert or update is_open and last_opened_at
    const existing = db
      .prepare("SELECT * FROM projects WHERE path = ?")
      .get(resolvedPath) as { id: number } | undefined;

    if (existing) {
      db.prepare(
        "UPDATE projects SET is_open = 1, last_opened_at = datetime('now') WHERE id = ?"
      ).run(existing.id);

      const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(existing.id);
      return NextResponse.json(updated);
    } else {
      const result = db
        .prepare(
          "INSERT INTO projects (path, name, is_open) VALUES (?, ?, 1)"
        )
        .run(resolvedPath, name);

      const newProject = db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(result.lastInsertRowid);
      return NextResponse.json(newProject, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to add project:", error);
    return NextResponse.json(
      { error: "Failed to add project" },
      { status: 500 }
    );
  }
}
