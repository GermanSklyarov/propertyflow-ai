import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { AiToolsPage } from "@views/ai-tools/ui/ai-tools-page";

export default async function AgencyAiToolsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const [listings, metrics] = await Promise.all([
    queryClient.ensureQueryData(listingsQueryOptions()),
    queryClient.ensureQueryData(tenantDashboardQueryOptions())
  ]);

  return <AiToolsPage listings={listings.items} metrics={metrics} />;
}
