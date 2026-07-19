import { currentTenantQueryOptions, tenantUsageQueryOptions } from "@entities/tenant/api/tenant-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { SettingsPage } from "@views/settings/ui/settings-page";

export default async function AgencySettingsPage({
  searchParams
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();

  try {
    const [tenant, usage] = await Promise.all([
      queryClient.ensureQueryData(currentTenantQueryOptions()),
      queryClient.ensureQueryData(tenantUsageQueryOptions())
    ]);

    return <SettingsPage settingsSaved={query.updated === "tenant-settings"} tenant={tenant} usage={usage} />;
  } catch (error) {
    return (
      <PageLoadState
        kicker="Tenant settings"
        message={getErrorMessage(error)}
        title="Could not load agency settings"
        variant="error"
      />
    );
  }
}
