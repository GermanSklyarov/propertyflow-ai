import { NextRequest, NextResponse } from "next/server";
import { verifyWidgetInstall } from "@shared/api/agency-client";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { url?: string };

  if (!body.url) {
    return NextResponse.json({ message: "URL is required" }, { status: 400 });
  }

  const result = await verifyWidgetInstall({ url: body.url });

  return NextResponse.json(result);
}
