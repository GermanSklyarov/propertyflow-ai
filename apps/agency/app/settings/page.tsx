import { currentTenantQueryOptions, tenantUsageQueryOptions } from "@entities/tenant/api/tenant-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { SettingsPage } from "@views/settings/ui/settings-page";

export default async function AgencySettingsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const [tenant, usage] = await Promise.all([
    queryClient.ensureQueryData(currentTenantQueryOptions()),
    queryClient.ensureQueryData(tenantUsageQueryOptions())
  ]);

  return <SettingsPage tenant={tenant} usage={usage} />;
}
