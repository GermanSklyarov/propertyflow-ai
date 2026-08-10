import { notFound } from "next/navigation";
import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { projectDetailQueryOptions } from "@entities/project/api/project-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { ProjectDetailPage } from "@views/project-detail/ui/project-detail-page";

export default async function AgencyProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const queryClient = createPropertyFlowQueryClient();
  const { tenantId } = await requireAgencySession();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(tenantId));

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    return (
      <PageLoadState
        kicker="Growth feature"
        message={buildPlanAccessMessage("Project workspace")}
        title="Upgrade to unlock project editing"
        variant="notice"
      />
    );
  }

  const project = await queryClient.ensureQueryData(projectDetailQueryOptions(projectId, tenantId));

  if (!project) {
    notFound();
  }

  const listings = await queryClient.ensureQueryData(
    listingsQueryOptions(
      {
        limit: 12,
        projectId,
        sort: "created-desc"
      },
      tenantId
    )
  );

  return <ProjectDetailPage listings={listings} project={project} />;
}
