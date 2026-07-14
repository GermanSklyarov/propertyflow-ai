import { NextRequest, NextResponse } from "next/server";
import { getBackgroundJob, listBackgroundJobs } from "@shared/api/agency-client";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  const jobs = await listBackgroundJobs(
    { limit: 100, states: ["active", "waiting", "completed", "failed"] },
    { revalidateSeconds: false }
  );
  const requestedJob = jobId ? await getBackgroundJob(jobId, { revalidateSeconds: false }) : null;
  const importJobs = jobs.items.filter((job) => job.name === "properties.import");
  const items =
    requestedJob?.name === "properties.import"
      ? [requestedJob, ...importJobs.filter((job) => job.id !== requestedJob.id)].slice(0, 5)
      : importJobs.slice(0, 5);

  return NextResponse.json({
    ...jobs,
    items
  });
}
