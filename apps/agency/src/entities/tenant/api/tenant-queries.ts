import { queryOptions } from "@tanstack/react-query";
import { getCurrentTenant, getTenantUsage } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

export function currentTenantQueryOptions(tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.tenant.current(tenantId),
    queryFn: () => getCurrentTenant({ tenantId })
  });
}

export function tenantUsageQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.tenant.usage(),
    queryFn: () => getTenantUsage()
  });
}
