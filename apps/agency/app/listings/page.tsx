import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import type { PropertySearchRequest, PropertySearchSort } from "@propertyflow/contracts";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingsPage } from "@views/listings/ui/listings-page";

const PAGE_SIZE = 8;
const listingSorts: PropertySearchSort[] = ["created-desc", "price-asc", "price-desc", "rent-asc", "yield-desc"];

export default async function AgencyListingsPage({
  searchParams
}: {
  searchParams: Promise<{
    importError?: "empty";
    importJob?: string;
    page?: string;
    projectLink?: PropertySearchRequest["projectLink"];
    query?: string;
    sort?: PropertySearchSort;
  }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const sort = query.sort && listingSorts.includes(query.sort) ? query.sort : "created-desc";
  const projectLink =
    query.projectLink === "linked" || query.projectLink === "missing" || query.projectLink === "all"
      ? query.projectLink
      : "all";
  const inventoryRequest: PropertySearchRequest = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    projectLink,
    query: query.query?.trim() || undefined,
    sort
  };
  const coverageRequest: PropertySearchRequest = { limit: 200, sort: "created-desc" };
  const [jobsResult, inventoryResult, coverageResult] = await Promise.allSettled([
    queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 })),
    queryClient.ensureQueryData(listingsQueryOptions(inventoryRequest)),
    queryClient.ensureQueryData(listingsQueryOptions(coverageRequest))
  ]);
  const importResult = query.importJob || query.importError ? { error: query.importError, jobId: query.importJob } : undefined;
  const jobs = jobsResult.status === "fulfilled" ? jobsResult.value : { items: [] };
  const inventory = inventoryResult.status === "fulfilled" ? inventoryResult.value : undefined;
  const coverage = coverageResult.status === "fulfilled" ? coverageResult.value : undefined;
  const inventoryError = inventoryResult.status === "rejected" ? toErrorMessage(inventoryResult.reason) : undefined;
  const importJobs = jobs.items.filter((job) => job.name === "properties.import").slice(0, 5);

  return (
    <ListingsPage
      coverageListings={coverage?.items ?? []}
      importJobs={importJobs}
      importResult={importResult}
      inventory={inventory}
      inventoryError={inventoryError}
      total={coverage?.total ?? inventory?.total ?? 0}
    />
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load listings";
}
