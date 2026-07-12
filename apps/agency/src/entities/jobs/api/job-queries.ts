import type { BackgroundJobState } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import { listBackgroundJobs } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

const defaultJobStates = ["active", "waiting", "completed", "failed"] satisfies BackgroundJobState[];

export function backgroundJobsQueryOptions(
  request: { limit?: number; states?: BackgroundJobState[] } = { limit: 12, states: defaultJobStates }
) {
  return queryOptions({
    queryKey: queryKeys.jobs.list(request),
    queryFn: () => listBackgroundJobs(request)
  });
}
