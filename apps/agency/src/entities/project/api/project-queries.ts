import type { PropertyProjectSearchRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import { getPropertyProject, searchPropertyProjects } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

const defaultProjectRequest = { limit: 50, offset: 0 } satisfies PropertyProjectSearchRequest;

export function projectsQueryOptions(request: PropertyProjectSearchRequest = defaultProjectRequest) {
  return queryOptions({
    queryKey: queryKeys.projects.list(request),
    queryFn: () => searchPropertyProjects(request, { revalidateSeconds: false })
  });
}

export function projectDetailQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => getPropertyProject(projectId)
  });
}
