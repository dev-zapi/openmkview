import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { SystemSettings, MarkdownWidthSetting } from "@/types";

const DEFAULT_SETTINGS: SystemSettings = {
  markdownWidth: {
    mode: "full",
    fixedWidth: "70%",
  },
};

// GET /api/settings - Get all settings
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];

    const settings: SystemSettings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      if (row.key === "markdownWidth") {
        try {
          settings.markdownWidth = JSON.parse(row.value) as MarkdownWidthSetting;
        } catch {
          // Use default if parsing fails
        }
      }
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// PUT /api/settings - Update settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    // Validate and save markdownWidth
    if (body.markdownWidth) {
      const mw = body.markdownWidth as MarkdownWidthSetting;

      // Validate mode
      if (mw.mode !== "full" && mw.mode !== "fixed") {
        return NextResponse.json(
          { error: "Invalid markdownWidth.mode. Must be 'full' or 'fixed'." },
          { status: 400 }
        );
      }

      // Validate fixedWidth format (percentage or number with unit)
      if (mw.mode === "fixed" && mw.fixedWidth) {
        const validPattern = /^\d+(\.\d+)?(px|rem|em|%|vw|ch)$/;
        if (!validPattern.test(mw.fixedWidth)) {
          return NextResponse.json(
            {
              error:
                "Invalid fixedWidth value. Must be a number with a unit (e.g., '1000px', '800rem', '70%').",
            },
            { status: 400 }
          );
        }
      }

      upsert.run("markdownWidth", JSON.stringify(mw));
    }

    // Return updated settings
    const rows = db.prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];

    const settings: SystemSettings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (row.key === "markdownWidth") {
        try {
          settings.markdownWidth = JSON.parse(row.value) as MarkdownWidthSetting;
        } catch {
          // Use default
        }
      }
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
