import { NextRequest, NextResponse } from "next/server";
import fg from "fast-glob";
import fuzzysort from "fuzzysort";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb } from "@/lib/db";

// Cache for directory list
let directoryCache: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

const IGNORE_DIRS = [
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
];

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

// 扫描 home 目录下 2 层深度的目录（用于模糊搜索）
async function getDirectories(): Promise<string[]> {
  const now = Date.now();
  if (directoryCache && now - cacheTimestamp < CACHE_TTL) {
    return directoryCache;
  }

  const homeDir = os.homedir();

  const entries = await fg(["*", "*/*"], {
    cwd: homeDir,
    onlyDirectories: true,
    dot: false,
    ignore: IGNORE_DIRS,
    deep: 2,
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

// 根据路径前缀实时扫描子目录
async function searchByPath(inputPath: string): Promise<string[]> {
  const homeDir = os.homedir();
  const isWindows = process.platform === "win32";

  // Normalize forward slashes to platform-specific separator
  const normalizedInput = isWindows ? inputPath.replace(/\//g, "\\") : inputPath;

  // Determine if it's an absolute path
  const isAbsolute = isWindows
    ? /^[A-Za-z]:[\\/]/.test(normalizedInput) // Windows: C:\ or C:/
    : normalizedInput.startsWith("/"); // Unix: /

  // Build base path
  const basePath = isAbsolute
    ? normalizedInput
    : path.join(homeDir, normalizedInput);

  // Find the last separator to split parent directory and prefix
  const sep = path.sep;
  const lastSep = basePath.lastIndexOf(sep);
  const parentDir = lastSep > 0 ? basePath.substring(0, lastSep) : (isWindows ? basePath.substring(0, 3) : "/");
  const prefix = basePath.substring(lastSep + 1).toLowerCase();

  if (!fs.existsSync(parentDir)) {
    return [];
  }

  try {
    const entries = await fg(["*"], {
      cwd: parentDir,
      onlyDirectories: true,
      dot: false,
      ignore: IGNORE_DIRS,
      deep: 1,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    const fullPaths = entries.map((entry) => path.join(parentDir, entry));

    if (!prefix) {
      return fullPaths.slice(0, 50);
    }

    // Filter by prefix
    return fullPaths
      .filter((p) => path.basename(p).toLowerCase().startsWith(prefix))
      .slice(0, 50);
  } catch {
    return [];
  }
}

function formatResult(dir: string, homeDir: string, isRecent = false) {
  return {
    path: dir,
    name: path.basename(dir),
    display: dir.startsWith(homeDir) ? dir.replace(homeDir, "~") : dir,
    isRecent,
  };
}

// GET /api/directories/search?q=... - Search directories for opening projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const homeDir = os.homedir();

    if (!query) {
      // 无搜索词时，优先展示最近打开的项目，再展示物理目录
      const directories = await getDirectories();
      const recentPaths = new Set(getRecentProjectPaths());
      const recent = directories
        .filter((dir) => recentPaths.has(dir))
        .slice(0, 20)
        .map((dir) => formatResult(dir, homeDir, true));
      const others = directories
        .filter((dir) => !recentPaths.has(dir))
        .slice(0, 50 - recent.length)
        .map((dir) => formatResult(dir, homeDir, false));
      return NextResponse.json([...recent, ...others]);
    }

    // Check if query contains path separators (/ or \) for path-based search
    const hasPathSeparator = query.includes("/") || query.includes("\\");
    const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(query);
    const isUnixAbsolute = query.startsWith("/");
    
    if (hasPathSeparator || isWindowsAbsolute || isUnixAbsolute) {
      const dirs = await searchByPath(query);
      const mapped = dirs.map((dir) => formatResult(dir, homeDir));
      return NextResponse.json(mapped);
    }

    // 普通关键词 → 模糊搜索缓存的目录列表
    const directories = await getDirectories();
    const results = fuzzysort.go(query, directories, { limit: 50 });

    const mapped = results.map((result) => ({
      ...formatResult(result.target, homeDir),
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
