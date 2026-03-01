import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb } from "@/lib/db";
import type { GitFileStatus, GitFileStatusCode, GitStatus, GitLogEntry } from "@/types";

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

// Parse git log output with custom format
function parseLogOutput(stdout: string): GitLogEntry[] {
  const entries: GitLogEntry[] = [];
  const lines = stdout.trim().split("\n");
  for (const line of lines) {
    if (!line) continue;
    const [hash, authorName, authorEmail, dateIso, ...messageParts] = line.split("\x00");
    if (hash) {
      entries.push({
        hash,
        shortHash: hash.slice(0, 7),
        authorName: authorName ?? "",
        authorEmail: authorEmail ?? "",
        date: dateIso ?? "",
        message: messageParts.join("\x00"),
      });
    }
  }
  return entries;
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
    const { action, projectId, files, message, limit, filePath, command } = body as {
      action: string;
      projectId: number;
      files?: string[];
      message?: string;
      limit?: number;
      filePath?: string;
      command?: string;
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

      case "pull": {
        const result = await runGit(cwd, ["pull"]);
        const status = await gitStatus(cwd);
        return NextResponse.json({ ...status, output: result.stdout + result.stderr });
      }

      case "pull-rebase": {
        const result = await runGit(cwd, ["pull", "--rebase"]);
        const status = await gitStatus(cwd);
        return NextResponse.json({ ...status, output: result.stdout + result.stderr });
      }

      case "fetch": {
        const result = await runGit(cwd, ["fetch", "--all"]);
        const status = await gitStatus(cwd);
        return NextResponse.json({ ...status, output: result.stdout + result.stderr });
      }

      case "log": {
        const n = limit && limit > 0 ? limit : 50;
        const logFormat = "%H%x00%an%x00%ae%x00%aI%x00%s";
        const result = await runGit(cwd, ["log", `--format=${logFormat}`, `-n`, String(n)]);
        const entries = parseLogOutput(result.stdout);
        return NextResponse.json({ entries });
      }

      case "diff": {
        const args = ["diff"];
        if (filePath) {
          args.push("--", filePath);
        }
        const result = await runGit(cwd, args);
        return NextResponse.json({ diff: result.stdout });
      }

      case "diff-staged": {
        const args = ["diff", "--cached"];
        if (filePath) {
          args.push("--", filePath);
        }
        const result = await runGit(cwd, args);
        return NextResponse.json({ diff: result.stdout });
      }

      case "show": {
        // Show a specific commit diff
        if (!message) {
          return NextResponse.json({ error: "Commit hash is required" }, { status: 400 });
        }
        const result = await runGit(cwd, ["show", message]);
        return NextResponse.json({ diff: result.stdout });
      }

      case "exec": {
        // Execute arbitrary git subcommand
        if (!command || command.trim().length === 0) {
          return NextResponse.json({ error: "Command is required" }, { status: 400 });
        }
        // Parse command string into args (simple split, doesn't handle quotes)
        const cmdArgs = command.trim().split(/\s+/);
        const result = await runGit(cwd, cmdArgs);
        return NextResponse.json({ output: result.stdout + result.stderr });
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
