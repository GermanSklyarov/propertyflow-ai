import { knowledgeChunkSearchQueryOptions, knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import type { KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { KnowledgeBasePage } from "@views/knowledge-base/ui/knowledge-base-page";

export default async function AgencyKnowledgePage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; document?: string; ingest?: string; kind?: string; locale?: string; q?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const retrievalRequest = buildRetrievalRequest(query);
  const [documents, retrieval] = await Promise.all([
    queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 24 })),
    queryClient.ensureQueryData(knowledgeChunkSearchQueryOptions(retrievalRequest))
  ]);

  return (
    <KnowledgeBasePage
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

function buildRetrievalRequest(query: { kind?: string; locale?: string; q?: string }): KnowledgeChunkSearchRequest {
  return {
    kind: isKnowledgeKind(query.kind) ? query.kind : undefined,
    limit: 5,
    locale: isLocale(query.locale) ? query.locale : undefined,
    query: query.q?.trim() || "wongamat family relocation"
  };
}

function isLocale(value?: string): value is KnowledgeChunkSearchRequest["locale"] {
  return value === "en" || value === "ru" || value === "th" || value === "zh";
}

function isKnowledgeKind(value?: string): value is NonNullable<KnowledgeChunkSearchRequest["kind"]> {
  return value === "article" || value === "neighborhood" || value === "relocation" || value === "legal" || value === "investment" || value === "faq";
}
