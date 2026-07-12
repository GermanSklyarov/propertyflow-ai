import { queryOptions } from "@tanstack/react-query";
import { listKnowledgeDocuments } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

export function knowledgeDocumentsQueryOptions(request: { limit?: number } = { limit: 24 }) {
  return queryOptions({
    queryKey: queryKeys.knowledge.list(request),
    queryFn: () => listKnowledgeDocuments(request)
  });
}
