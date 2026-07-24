import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { knowledgeChunkSearchQueryOptions, knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { buildKnowledgePageNotice } from "@entities/knowledge/model/knowledge-page-notice";
import type { AiChatRequest, KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { askAiChat } from "@shared/api/agency-client";
import { getErrorMessage } from "@shared/lib/errors";
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
    ingest?: string;
    kind?: string;
    locale?: string;
    q?: string;
  }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const retrievalRequest = buildRetrievalRequest(query);
  const chatRequest = buildChatRequest(query);

  try {
    const [documents, jobs, retrieval] = await Promise.all([
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 24 })),
      queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 })),
      queryClient.ensureQueryData(knowledgeChunkSearchQueryOptions(retrievalRequest))
    ]);
    const chat = chatRequest ? await askAiChat(chatRequest) : undefined;
    const knowledgeJobs = jobs.items.filter((job) => job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed");

    return (
      <KnowledgeBasePage
        chat={chat}
        chatRequest={chatRequest}
        createSourceOpen={query.create === "source"}
        documents={documents.items}
        jobs={knowledgeJobs}
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
