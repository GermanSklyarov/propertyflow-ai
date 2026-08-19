import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    return widgetRuntimeResponse(
      await readFile(join(/* turbopackIgnore: true */ process.cwd(), "apps/web/public/widget.js"), "utf8")
    );
  } catch {
    // Try the next workspace layout candidate.
  }

  try {
    return widgetRuntimeResponse(
      await readFile(join(/* turbopackIgnore: true */ process.cwd(), "../web/public/widget.js"), "utf8")
    );
  } catch {
    // Fall through to the 404 below.
  }

  return NextResponse.json({ message: "Widget runtime was not found" }, { status: 404 });
}

function widgetRuntimeResponse(runtime: string): NextResponse {
  return new NextResponse(runtime, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript; charset=utf-8"
    }
  });
}
