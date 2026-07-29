import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { knowledgeDocumentsQueryOptions, knowledgeEmbeddingHealthQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { resolveSignupPlan } from "@views/agency-entry/model/agency-entry";
import { StarterSetupPage } from "@views/starter-setup/ui/starter-setup-page";

export default async function AgencyStarterSetupPage({
  searchParams
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const { plan } = await searchParams;
  const requestedPlan = resolveSignupPlan(plan);
  const session = await requireAgencySession();
  const tenantId = session.tenantId;
  const queryClient = createPropertyFlowQueryClient();

  try {
    const [tenant, documentsResult, jobsResult, embeddingHealth] = await Promise.all([
      queryClient.ensureQueryData(currentTenantQueryOptions(tenantId)),
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 80 }, tenantId)),
      queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 }, tenantId)),
      queryClient.ensureQueryData(knowledgeEmbeddingHealthQueryOptions(tenantId))
    ]);

    return (
      <StarterSetupPage
        documents={documentsResult.items}
        embeddingHealth={embeddingHealth}
        jobs={jobsResult.items}
        requestedPlan={requestedPlan}
        tenant={tenant}
      />
    );
  } catch (error) {
    return (
      <PageLoadState
        kicker="Starter setup"
        message={getErrorMessage(error)}
        title="Could not load Starter setup"
        variant="error"
      />
    );
  }
}
