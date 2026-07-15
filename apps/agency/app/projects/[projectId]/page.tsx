import { notFound } from "next/navigation";
import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { projectDetailQueryOptions } from "@entities/project/api/project-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ProjectDetailPage } from "@views/project-detail/ui/project-detail-page";

export default async function AgencyProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const queryClient = createPropertyFlowQueryClient();
  const project = await queryClient.ensureQueryData(projectDetailQueryOptions(projectId));

  if (!project) {
    notFound();
  }

  const listings = await queryClient.ensureQueryData(
    listingsQueryOptions({
      limit: 12,
      projectId,
      sort: "created-desc"
    })
  );

  return <ProjectDetailPage listings={listings} project={project} />;
}
