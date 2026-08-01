import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import {
  knowledgeChunkSearchQueryOptions,
  knowledgeDocumentsQueryOptions,
  knowledgeEmbeddingHealthQueryOptions,
  listingSourcesQueryOptions
} from "@entities/knowledge/api/knowledge-queries";
import { buildKnowledgePageNotice } from "@entities/knowledge/model/knowledge-page-notice";
import type { AiChatRequest, KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { askAiChat } from "@shared/api/agency-client";
import { getErrorMessage } from "@shared/lib/errors";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { KnowledgeBasePage } from "@views/knowledge-base/ui/knowledge-base-page";

export default async function AgencyKnowledgePage({
  searchParams
}: {
  searchParams: Promise<{
    ask?: string;
    create?: string;
    created?: string;
    document?: string;
    embed?: string;
    error?: string;
    fields?: string;
    ingest?: string;
    items?: string;
    kind?: string;
    listingPreview?: string;
    listingSync?: string;
    locale?: string;
    q?: string;
    source?: string;
    warnings?: string;
  }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const { tenantId } = await requireAgencySession();
  const retrievalRequest = buildRetrievalRequest(query);
  const chatRequest = buildChatRequest(query);

  try {
    const [documents, jobs, retrieval, embeddingHealth, listingSources] = await Promise.all([
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 24 }, tenantId)),
      queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 }, tenantId)),
      queryClient.ensureQueryData(knowledgeChunkSearchQueryOptions(retrievalRequest, tenantId)),
      queryClient.ensureQueryData(knowledgeEmbeddingHealthQueryOptions(tenantId)),
      queryClient.ensureQueryData(listingSourcesQueryOptions(tenantId))
    ]);
    const chat = chatRequest ? await askAiChat(chatRequest, { tenantId }) : undefined;
    const knowledgeJobs = jobs.items.filter((job) => job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed");

    return (
      <KnowledgeBasePage
        chat={chat}
        chatRequest={chatRequest}
        createSourceOpen={query.create === "source"}
        documents={documents.items}
        jobs={knowledgeJobs}
        embeddingHealth={embeddingHealth}
        listingSources={listingSources.items}
        notice={buildKnowledgePageNotice(query)}
        retrieval={retrieval}
        retrievalRequest={retrievalRequest}
        sourceJobs={jobs.items}
        total={documents.total}
      />
    );
  } catch (error) {
    return (
      <PageLoadState
        kicker="Knowledge base"
        message={getErrorMessage(error)}
        title="Could not load AI knowledge workspace"
        variant="error"
      />
    );
  }
}

function buildChatRequest(query: { ask?: string; locale?: string }): AiChatRequest | undefined {
  const message = query.ask?.trim();

  if (!message) {
    return undefined;
  }

  return {
    locale: isLocale(query.locale) ? query.locale : "en",
    message
  };
}

function buildRetrievalRequest(query: { kind?: string; locale?: string; q?: string }): KnowledgeChunkSearchRequest {
  return {
    kind: isKnowledgeKind(query.kind) ? query.kind : undefined,
    limit: 5,
    locale: isLocale(query.locale) ? query.locale : undefined,
    query: query.q?.trim() || "wongamat family relocation"
  };
}

function isLocale(value?: string): value is AiChatRequest["locale"] {
  return value === "en" || value === "ru" || value === "th" || value === "zh";
}

function isKnowledgeKind(value?: string): value is NonNullable<KnowledgeChunkSearchRequest["kind"]> {
  return value === "article" || value === "neighborhood" || value === "relocation" || value === "legal" || value === "investment" || value === "faq";
}
