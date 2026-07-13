import { knowledgeChunkSearchQueryOptions, knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import type { AiChatRequest, KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { askAiChat } from "@shared/api/agency-client";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { KnowledgeBasePage } from "@views/knowledge-base/ui/knowledge-base-page";

export default async function AgencyKnowledgePage({
  searchParams
}: {
  searchParams: Promise<{ ask?: string; created?: string; document?: string; ingest?: string; kind?: string; locale?: string; q?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const retrievalRequest = buildRetrievalRequest(query);
  const chatRequest = buildChatRequest(query);
  const [documents, retrieval] = await Promise.all([
    queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 24 })),
    queryClient.ensureQueryData(knowledgeChunkSearchQueryOptions(retrievalRequest))
  ]);
  const chat = chatRequest ? await askAiChat(chatRequest) : undefined;

  return (
    <KnowledgeBasePage
      chat={chat}
      chatRequest={chatRequest}
      documents={documents.items}
      notice={
        query.created
          ? { message: `${query.created} was added and queued for ingestion.`, tone: "success" }
          : query.ingest === "queued"
            ? { message: `${query.document ?? "Knowledge document"} was queued for re-ingestion.`, tone: "success" }
            : undefined
      }
      retrieval={retrieval}
      retrievalRequest={retrievalRequest}
      total={documents.total}
    />
  );
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
