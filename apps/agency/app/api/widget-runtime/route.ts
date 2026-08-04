import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const widgetRuntimeCandidates = [
  join(process.cwd(), "../web/public/widget.js"),
  join(process.cwd(), "apps/web/public/widget.js")
];

export async function GET() {
  for (const path of widgetRuntimeCandidates) {
    try {
      const runtime = await readFile(path, "utf8");

      return new NextResponse(runtime, {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/javascript; charset=utf-8"
        }
      });
    } catch {
      // Try the next workspace layout candidate.
    }
  }

  return NextResponse.json({ message: "Widget runtime was not found" }, { status: 404 });
}
