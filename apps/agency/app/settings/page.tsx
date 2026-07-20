import { currentTenantQueryOptions, tenantUsageQueryOptions } from "@entities/tenant/api/tenant-queries";
import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { SettingsPage } from "@views/settings/ui/settings-page";

export default async function AgencySettingsPage({
  searchParams
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();

  try {
    const [tenant, usage, documentsResult, jobsResult] = await Promise.all([
      queryClient.ensureQueryData(currentTenantQueryOptions()),
      queryClient.ensureQueryData(tenantUsageQueryOptions()),
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 50 })),
      queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 }))
    ]);
    const knowledgeJobs = jobsResult.items.filter(
      (job) => job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed"
    );

    return (
      <SettingsPage
        knowledgeDocuments={documentsResult.items}
        knowledgeJobs={knowledgeJobs}
        settingsSaved={query.updated === "tenant-settings"}
        tenant={tenant}
        usage={usage}
      />
    );
  } catch (error) {
    return (
      <PageLoadState
        kicker="Tenant settings"
        message={getErrorMessage(error)}
        title="Could not load agency settings"
        variant="error"
      />
    );
  }
}
