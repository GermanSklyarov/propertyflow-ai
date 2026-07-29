import { NextResponse } from "next/server";
import type { BackgroundJobMonitorItem, BackgroundJobState, KnowledgeEmbeddingHealthSnapshot } from "@propertyflow/contracts";
import { embedKnowledgeChunks, getKnowledgeEmbeddingHealth, listBackgroundJobs } from "@shared/api/agency-client";
import { getAgencySession } from "@shared/lib/tenant-session";

const embeddingJobStates: BackgroundJobState[] = ["active", "waiting", "delayed", "completed", "failed"];

interface KnowledgeVectorRefreshSnapshot {
  health: KnowledgeEmbeddingHealthSnapshot;
  job: BackgroundJobMonitorItem | null;
}

export async function GET() {
  const session = await getAgencySession();

  if (!session) {
    return NextResponse.json({ message: "Agency session is required" }, { status: 401 });
  }

  try {
    const [health, jobs] = await Promise.all([
      getKnowledgeEmbeddingHealth({
        revalidateSeconds: false,
        tenantId: session.tenantId
      }),
      listBackgroundJobs(
        {
          limit: 25,
          states: embeddingJobStates
        },
        {
          revalidateSeconds: false,
          tenantId: session.tenantId
        }
      )
    ]);
    const job = jobs.items.find((item) => item.name === "knowledge.chunks.embed") ?? null;

    return NextResponse.json({ health, job } satisfies KnowledgeVectorRefreshSnapshot);
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
