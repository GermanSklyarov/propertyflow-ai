import { NextResponse } from "next/server";
import { embedKnowledgeChunks, getKnowledgeEmbeddingHealth } from "@shared/api/agency-client";
import { getAgencySession } from "@shared/lib/tenant-session";

export async function GET() {
  const session = await getAgencySession();

  if (!session) {
    return NextResponse.json({ message: "Agency session is required" }, { status: 401 });
  }

  try {
    const health = await getKnowledgeEmbeddingHealth({
      revalidateSeconds: false,
      tenantId: session.tenantId
    });

    return NextResponse.json(health);
  } catch {
    return NextResponse.json({ message: "Failed to load knowledge vector health" }, { status: 500 });
  }
}

export async function POST() {
  const session = await getAgencySession();

  if (!session) {
    return NextResponse.json({ message: "Agency session is required" }, { status: 401 });
  }

  try {
    const job = await embedKnowledgeChunks(
      {
        limit: 100,
        refreshExisting: true
      },
      { tenantId: session.tenantId }
    );

    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ message: "Failed to queue knowledge vector refresh" }, { status: 500 });
  }
}
