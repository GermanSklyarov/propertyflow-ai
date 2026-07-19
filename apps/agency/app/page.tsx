import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { AgencyDashboardPage } from "@views/agency-dashboard/ui/agency-dashboard-page";

export default async function AgencyHomePage() {
  const queryClient = createPropertyFlowQueryClient();

  try {
    const metrics = await queryClient.ensureQueryData(tenantDashboardQueryOptions());

    return <AgencyDashboardPage metrics={metrics} />;
  } catch (error) {
    return (
      <PageLoadState
        kicker="Agency command center"
        message={getErrorMessage(error)}
        title="Could not load dashboard"
        variant="error"
      />
    );
  }
}
