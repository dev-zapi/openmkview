import { NextRequest, NextResponse } from "next/server";
import fg from "fast-glob";
import fuzzysort from "fuzzysort";
import os from "os";
import path from "path";
import { getDb } from "@/lib/db";

// Cache for directory list
let directoryCache: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

// 获取最近打开过的项目路径
function getRecentProjectPaths(): string[] {
  try {
    const db = getDb();
    const projects = db
      .prepare("SELECT path FROM projects ORDER BY last_opened_at DESC")
      .all() as { path: string }[];
    return projects.map((p) => p.path);
  } catch {
    return [];
  }
}

async function getDirectories(): Promise<string[]> {
  const now = Date.now();
  if (directoryCache && now - cacheTimestamp < CACHE_TTL) {
    return directoryCache;
  }

  const homeDir = os.homedir();

  // Scan home directory for potential project directories (3 levels deep)
  const entries = await fg(["*", "*/*", "*/*/*"], {
    cwd: homeDir,
    onlyDirectories: true,
    dot: false,
    ignore: [
      "node_modules",
      ".git",
      ".cache",
      ".local",
      ".config",
      "Library",
      "AppData",
      ".npm",
      ".nvm",
      ".sdkman",
      ".vscode",
      ".cursor",
      "snap",
      ".wine",
      ".steam",
    ],
    deep: 3,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  const scannedDirs = entries.map((entry) => path.join(homeDir, entry));

  // 合并物理目录和最近打开过的项目，去重
  const recentPaths = getRecentProjectPaths();
  const dirSet = new Set(scannedDirs);
  for (const p of recentPaths) {
    dirSet.add(p);
  }

  directoryCache = Array.from(dirSet);
  cacheTimestamp = now;

  return directoryCache;
}

// GET /api/directories/search?q=... - Search directories for opening projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    const directories = await getDirectories();
    const homeDir = os.homedir();

    if (!query) {
      // 无搜索词时，优先展示最近打开的项目，再展示物理目录
      const recentPaths = new Set(getRecentProjectPaths());
      const recent = directories
        .filter((dir) => recentPaths.has(dir))
        .slice(0, 20)
        .map((dir) => ({
          path: dir,
          name: path.basename(dir),
          display: dir.replace(homeDir, "~"),
          isRecent: true,
        }));
      const others = directories
        .filter((dir) => !recentPaths.has(dir))
        .slice(0, 50 - recent.length)
        .map((dir) => ({
          path: dir,
          name: path.basename(dir),
          display: dir.replace(homeDir, "~"),
          isRecent: false,
        }));
      return NextResponse.json([...recent, ...others]);
    }

    // Fuzzy search
    const results = fuzzysort.go(query, directories, { limit: 50 });

    const mapped = results.map((result) => ({
      path: result.target,
      name: path.basename(result.target),
      display: result.target.replace(homeDir, "~"),
      score: result.score,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Failed to search directories:", error);
    return NextResponse.json(
      { error: "Failed to search directories" },
      { status: 500 }
    );
  }
}
