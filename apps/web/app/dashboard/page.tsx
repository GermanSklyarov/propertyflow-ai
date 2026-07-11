import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { AgencyDashboardPage } from "@views/agency-dashboard/ui/agency-dashboard-page";

export default async function DashboardPage() {
  const queryClient = createPropertyFlowQueryClient();
  const metrics = await queryClient.ensureQueryData(tenantDashboardQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgencyDashboardPage metrics={metrics} />
    </HydrationBoundary>
  );
}
