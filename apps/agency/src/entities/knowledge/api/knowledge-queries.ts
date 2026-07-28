import type { KnowledgeChunkSearchRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import { getKnowledgeEmbeddingHealth, listKnowledgeDocuments, searchKnowledgeChunks } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

export function knowledgeDocumentsQueryOptions(request: { limit?: number } = { limit: 24 }, tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.knowledge.list(request, tenantId),
    queryFn: () => listKnowledgeDocuments(request, { tenantId })
  });
}

export function knowledgeChunkSearchQueryOptions(request: KnowledgeChunkSearchRequest, tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.knowledge.chunks(request, tenantId),
    queryFn: () => searchKnowledgeChunks(request, { tenantId })
  });
}

export function knowledgeEmbeddingHealthQueryOptions(tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.knowledge.embeddingHealth(tenantId),
    queryFn: () => getKnowledgeEmbeddingHealth({ tenantId })
  });
}
