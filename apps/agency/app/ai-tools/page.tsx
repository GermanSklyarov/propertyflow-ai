import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import {
  listingAiAssetsQueryOptions,
  listingImagesQueryOptions,
  listingsQueryOptions
} from "@entities/listing/api/listing-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { AiToolsPage } from "@views/ai-tools/ui/ai-tools-page";

export default async function AgencyAiToolsPage({
  searchParams
}: {
  searchParams: Promise<{ assistant?: string; jobs?: string; policy?: string; property?: string; propertyId?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const { tenantId } = await requireAgencySession();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(tenantId));

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    return (
      <PageLoadState
        kicker="Growth feature"
        message={buildPlanAccessMessage("AI tools")}
        title="Upgrade to unlock CRM automation"
        variant="notice"
      />
    );
  }

  const [listings, metrics] = await Promise.all([
    queryClient.ensureQueryData(listingsQueryOptions(undefined, tenantId)),
    queryClient.ensureQueryData(tenantDashboardQueryOptions())
  ]);
  const jobs = await queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 8 }, tenantId));
  const galleries = await Promise.all(
    listings.items.map((listing) => queryClient.ensureQueryData(listingImagesQueryOptions(listing.id, tenantId)))
  );
  const aiAssets = await Promise.all(
    listings.items.map((listing) => queryClient.ensureQueryData(listingAiAssetsQueryOptions(listing.id, tenantId)))
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
