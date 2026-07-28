import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { WidgetDemoPage } from "@views/widget-demo/ui/widget-demo-page";

export default async function AgencyWidgetDemoPage() {
  const { tenantId } = await requireAgencySession();
  const queryClient = createPropertyFlowQueryClient();

  try {
    const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(tenantId));

    return <WidgetDemoPage tenant={tenant} />;
  } catch (error) {
    return (
      <PageLoadState
        kicker="Widget demo"
        message={getErrorMessage(error)}
        title="Could not load widget demo"
        variant="error"
      />
    );
  }
}
