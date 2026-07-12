import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { AnalyticsPage } from "@views/analytics/ui/analytics-page";

export default async function AgencyAnalyticsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const metrics = await queryClient.ensureQueryData(tenantDashboardQueryOptions());

  return <AnalyticsPage metrics={metrics} />;
}
