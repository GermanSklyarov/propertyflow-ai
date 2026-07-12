import { knowledgeDocumentsQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { KnowledgeBasePage } from "@views/knowledge-base/ui/knowledge-base-page";

export default async function AgencyKnowledgePage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; document?: string; ingest?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const documents = await queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ limit: 24 }));

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
      total={documents.total}
    />
  );
}
