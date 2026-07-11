import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { AgencyDashboardPage } from "@views/agency-dashboard/ui/agency-dashboard-page";

export default async function AgencyHomePage() {
  const queryClient = createPropertyFlowQueryClient();
  const metrics = await queryClient.ensureQueryData(tenantDashboardQueryOptions());

  return <AgencyDashboardPage metrics={metrics} />;
}
