import { queryOptions } from "@tanstack/react-query";
import { getTenantDashboardMetrics } from "@shared/api/propertyflow-client";
import { queryKeys } from "@shared/query/query-keys";

export function tenantDashboardQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.analytics.dashboard(),
    queryFn: () => getTenantDashboardMetrics()
  });
}
