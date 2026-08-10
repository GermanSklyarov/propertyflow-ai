import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { AgencyDashboardPage } from "@views/agency-dashboard/ui/agency-dashboard-page";

export default async function AgencyDashboardRoute() {
  const session = await requireAgencySession();
  const queryClient = createPropertyFlowQueryClient();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(session.tenantId));

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    return (
      <PageLoadState
        kicker="Growth feature"
        message={buildPlanAccessMessage("Dashboard")}
        title="Upgrade to unlock the CRM command center"
        variant="notice"
      />
    );
  }

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
