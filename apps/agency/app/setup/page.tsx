import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { getErrorMessage } from "@shared/lib/errors";
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
  const queryClient = createPropertyFlowQueryClient();

  try {
    const [tenant, documentsResult, jobsResult] = await Promise.all([
      queryClient.ensureQueryData(currentTenantQueryOptions()),
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 80 })),
      queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 }))
    ]);

    return <StarterSetupPage documents={documentsResult.items} jobs={jobsResult.items} requestedPlan={requestedPlan} tenant={tenant} />;
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
