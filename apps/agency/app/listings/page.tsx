import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingsPage } from "@views/listings/ui/listings-page";

export default async function AgencyListingsPage({
  searchParams
}: {
  searchParams: Promise<{ importError?: "empty"; importJob?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const [jobs, listings] = await Promise.all([
    queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 })),
    queryClient.ensureQueryData(listingsQueryOptions())
  ]);
  const importResult = query.importJob || query.importError ? { error: query.importError, jobId: query.importJob } : undefined;
  const importJobs = jobs.items.filter((job) => job.name === "properties.import").slice(0, 5);

  return <ListingsPage importJobs={importJobs} importResult={importResult} listings={listings.items} total={listings.total} />;
}
