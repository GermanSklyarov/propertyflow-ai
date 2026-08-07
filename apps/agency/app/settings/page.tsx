import { currentTenantQueryOptions, tenantUsageQueryOptions } from "@entities/tenant/api/tenant-queries";
import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { SettingsPage } from "@views/settings/ui/settings-page";
import type { NotificationActionResult } from "@features/tenant-settings-update/ui/tenant-lead-notification-fields";

export default async function AgencySettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    notificationAction?: string;
    notificationCode?: string;
    notificationError?: string;
    notificationExpiresAt?: string;
    notificationName?: string;
    notificationProvider?: string;
    notificationStatus?: string;
    notificationWebhookUrl?: string;
    updated?: string;
  }>;
}) {
  const query = await searchParams;
  const { tenantId } = await requireAgencySession();
  const queryClient = createPropertyFlowQueryClient();

  try {
    const [tenant, usage, documentsResult, jobsResult] = await Promise.all([
      queryClient.ensureQueryData(currentTenantQueryOptions(tenantId)),
      queryClient.ensureQueryData(tenantUsageQueryOptions(tenantId)),
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 50 }, tenantId)),
      queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 }, tenantId))
    ]);
    const knowledgeJobs = jobsResult.items.filter(
      (job) => job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed"
    );

    return (
      <SettingsPage
        knowledgeDocuments={documentsResult.items}
        knowledgeJobs={knowledgeJobs}
        notificationResult={parseNotificationResult(query)}
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

function parseNotificationResult(query: {
  notificationAction?: string;
  notificationCode?: string;
  notificationError?: string;
  notificationExpiresAt?: string;
  notificationName?: string;
  notificationProvider?: string;
  notificationStatus?: string;
  notificationWebhookUrl?: string;
}): NotificationActionResult | undefined {
  const action = query.notificationAction;
  const provider = query.notificationProvider;
  const status = query.notificationStatus;

  if ((action !== "connect" && action !== "test" && action !== "verify") || !isNotificationProvider(provider) || !isNotificationStatus(status)) {
    return undefined;
  }

  return {
    action,
    code: query.notificationCode,
    displayName: query.notificationName,
    error: query.notificationError,
    expiresAt: query.notificationExpiresAt,
    provider,
    status,
    webhookUrl: query.notificationWebhookUrl
  };
}

function isNotificationProvider(value: string | undefined): value is NotificationActionResult["provider"] {
  return value === "telegram" || value === "line" || value === "whatsapp";
}

function isNotificationStatus(value: string | undefined): value is NotificationActionResult["status"] {
  return value === "connected" || value === "failed" || value === "missing-credentials" || value === "missing-recipient";
}
