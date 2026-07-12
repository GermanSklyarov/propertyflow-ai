import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { listingAiAssetsQueryOptions, listingImagesQueryOptions, listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { AiToolsPage } from "@views/ai-tools/ui/ai-tools-page";

export default async function AgencyAiToolsPage({
  searchParams
}: {
  searchParams: Promise<{ assistant?: string; jobs?: string; policy?: string; property?: string; propertyId?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const [listings, metrics] = await Promise.all([
    queryClient.ensureQueryData(listingsQueryOptions()),
    queryClient.ensureQueryData(tenantDashboardQueryOptions())
  ]);
  const jobs = await queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 8 }));
  const galleries = await Promise.all(
    listings.items.map((listing) => queryClient.ensureQueryData(listingImagesQueryOptions(listing.id)))
  );
  const aiAssets = await Promise.all(
    listings.items.map((listing) => queryClient.ensureQueryData(listingAiAssetsQueryOptions(listing.id)))
  );

  return (
    <AiToolsPage
      assistantResult={
        query.assistant === "queued"
          ? {
              jobs: Number(query.jobs ?? 0),
              policyItems: Number(query.policy ?? 0),
              property: query.property ?? "Selected listing",
              propertyId: query.propertyId
            }
          : undefined
      }
      aiAssets={aiAssets}
      galleries={galleries}
      jobs={jobs}
      listings={listings.items}
      metrics={metrics}
    />
  );
}
