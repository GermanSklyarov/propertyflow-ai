import { queryOptions } from "@tanstack/react-query";
import { getCurrentTenant, getTenantUsage } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

export function currentTenantQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.tenant.current(),
    queryFn: () => getCurrentTenant()
  });
}

export function tenantUsageQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.tenant.usage(),
    queryFn: () => getTenantUsage()
  });
}
