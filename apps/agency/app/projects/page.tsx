import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ProjectsPage } from "@views/projects/ui/projects-page";

export default async function AgencyProjectsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const listings = await queryClient.ensureQueryData(listingsQueryOptions({ limit: 100, sort: "created-desc" }));

  return <ProjectsPage listings={listings.items} total={listings.total} />;
}
