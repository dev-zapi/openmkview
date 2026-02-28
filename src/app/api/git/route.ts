import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb } from "@/lib/db";
import type { GitFileStatus, GitFileStatusCode, GitStatus } from "@/types";

const execFileAsync = promisify(execFile);

function getProjectPath(projectId: number): string | null {
  const db = getDb();
  const row = db.prepare("SELECT path FROM projects WHERE id = ?").get(projectId) as
    | { path: string }
    | undefined;
  return row?.path ?? null;
}

async function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
}

function parseStatus(stdout: string): GitFileStatus[] {
  const files: GitFileStatus[] = [];
  for (const line of stdout.split("\n")) {
    if (line.length < 4) continue;
    const index = line[0] as GitFileStatusCode;
    const workTree = line[1] as GitFileStatusCode;
    const filePath = line.slice(3);
    files.push({ path: filePath, index, workTree });
  }
  return files;
}

async function gitStatus(cwd: string): Promise<GitStatus> {
  try {
    const [statusResult, branchResult] = await Promise.all([
      runGit(cwd, ["status", "--porcelain"]),
      runGit(cwd, ["branch", "--show-current"]),
    ]);
    return {
      isRepo: true,
      branch: branchResult.stdout.trim(),
      files: parseStatus(statusResult.stdout),
    };
  } catch {
    return { isRepo: false, branch: "", files: [] };
  }
}

// POST /api/git
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, files, message } = body as {
      action: string;
      projectId: number;
      files?: string[];
      message?: string;
    };

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const cwd = getProjectPath(projectId);
    if (!cwd) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    switch (action) {
      case "status": {
        const status = await gitStatus(cwd);
        return NextResponse.json(status);
      }

      case "add": {
        const targets = files && files.length > 0 ? files : ["."];
        await runGit(cwd, ["add", ...targets]);
        const status = await gitStatus(cwd);
        return NextResponse.json(status);
      }

      case "commit": {
        if (!message || message.trim().length === 0) {
          return NextResponse.json({ error: "Commit message is required" }, { status: 400 });
        }
        await runGit(cwd, ["commit", "-m", message]);
        const status = await gitStatus(cwd);
        return NextResponse.json(status);
      }

      case "push": {
        await runGit(cwd, ["push"]);
        const status = await gitStatus(cwd);
        return NextResponse.json(status);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Git operation failed";
    console.error("Git operation error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
