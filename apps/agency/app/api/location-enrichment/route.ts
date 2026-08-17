import { NextRequest, NextResponse } from "next/server";
import {
  enqueueLocationEnrichmentAction,
  getLocationEnrichmentStatus,
  listBackgroundJobs
} from "@shared/api/agency-client";
import { getAgencySession } from "@shared/lib/tenant-session";

export async function GET() {
  const session = await getAgencySession();

  if (!session) {
    return NextResponse.json({ message: "Agency session is required" }, { status: 401 });
  }

  const [status, jobs] = await Promise.all([
    getLocationEnrichmentStatus({ revalidateSeconds: false, tenantId: session.tenantId }),
    listBackgroundJobs({ limit: 50, states: ["active", "waiting", "completed", "failed"] }, { revalidateSeconds: false, tenantId: session.tenantId })
  ]);
  const enrichmentJobs = jobs.items
    .filter((job) => job.name === "properties.location.enrich_existing" || job.name === "properties.location.enrich")
    .slice(0, 5);

  return NextResponse.json({
    jobs: enrichmentJobs,
    status
  });
}

export async function POST(request: NextRequest) {
  const session = await getAgencySession();

  if (!session) {
    return NextResponse.json({ message: "Agency session is required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "retry-failed" ? "retry-failed" : body.action === "enrich-missing" ? "enrich-missing" : undefined;

  if (!action) {
    return NextResponse.json({ message: "Unsupported location enrichment action" }, { status: 400 });
  }

  const job = await enqueueLocationEnrichmentAction(action, { tenantId: session.tenantId });

  return NextResponse.json({ job });
}
