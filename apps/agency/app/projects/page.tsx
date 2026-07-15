import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { projectsQueryOptions } from "@entities/project/api/project-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ProjectsPage } from "@views/projects/ui/projects-page";

export default async function AgencyProjectsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const [projectsResult, missingListingsResult] = await Promise.allSettled([
    queryClient.ensureQueryData(projectsQueryOptions({ limit: 50, offset: 0 })),
    queryClient.ensureQueryData(listingsQueryOptions({ limit: 12, projectLink: "missing", sort: "created-desc" }))
  ]);
  const projects =
    projectsResult.status === "fulfilled" ? projectsResult.value : { filters: { limit: 50, offset: 0 }, items: [], total: 0 };
  const missingListings =
    missingListingsResult.status === "fulfilled"
      ? missingListingsResult.value
      : { filters: { limit: 12, projectLink: "missing" as const, sort: "created-desc" as const }, items: [], total: 0 };

  return <ProjectsPage missingListings={missingListings} projects={projects} />;
}
