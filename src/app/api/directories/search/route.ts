import { NextRequest, NextResponse } from "next/server";
import fg from "fast-glob";
import fuzzysort from "fuzzysort";
import os from "os";
import path from "path";

// Cache for directory list
let directoryCache: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function getDirectories(): Promise<string[]> {
  const now = Date.now();
  if (directoryCache && now - cacheTimestamp < CACHE_TTL) {
    return directoryCache;
  }

  const homeDir = os.homedir();

  // Scan home directory for potential project directories (2 levels deep)
  // This finds directories that contain files (likely projects)
  const entries = await fg(["*", "*/*"], {
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
    deep: 2,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  directoryCache = entries.map((entry) => path.join(homeDir, entry));
  cacheTimestamp = now;

  return directoryCache;
}

// GET /api/directories/search?q=... - Search directories for opening projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    const directories = await getDirectories();

    if (!query) {
      // Return first 50 directories sorted by name
      const homeDir = os.homedir();
      const results = directories.slice(0, 50).map((dir) => ({
        path: dir,
        name: path.basename(dir),
        display: dir.replace(homeDir, "~"),
      }));
      return NextResponse.json(results);
    }

    // Fuzzy search
    const results = fuzzysort.go(query, directories, { limit: 50 });

    const homeDir = os.homedir();
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
