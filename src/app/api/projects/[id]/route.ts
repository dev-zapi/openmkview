import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// DELETE /api/projects/[id] - Close a project (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const db = getDb();

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Soft close: set is_open = false, keep in history
    db.prepare("UPDATE projects SET is_open = 0 WHERE id = ?").run(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to close project:", error);
    return NextResponse.json(
      { error: "Failed to close project" },
      { status: 500 }
    );
  }
}
