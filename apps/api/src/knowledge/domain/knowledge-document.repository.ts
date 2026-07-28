import type {
  CreateKnowledgeDocumentRequest,
  KnowledgeEmbeddingHealthSnapshot,
  KnowledgeChunkSearchRequest,
  KnowledgeDocumentChunkSnapshot,
  KnowledgeDocumentSearchRequest,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";
import type { KnowledgeEmbeddingResult } from "@propertyflow/domain";

export const KNOWLEDGE_DOCUMENT_REPOSITORY = Symbol("KNOWLEDGE_DOCUMENT_REPOSITORY");

export interface KnowledgeDocumentRepository {
  save(tenantId: string, request: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentSnapshot>;
  search(tenantId: string, request: KnowledgeDocumentSearchRequest): Promise<KnowledgeDocumentSnapshot[]>;
  searchChunks(
    tenantId: string,
    request: KnowledgeChunkSearchRequest,
    queryEmbedding?: KnowledgeEmbeddingResult
  ): Promise<KnowledgeDocumentChunkSnapshot[]>;
  summarizeChunkEmbeddingHealth(
    tenantId: string,
    targetModelKey: string
  ): Promise<
    Pick<
      KnowledgeEmbeddingHealthSnapshot,
      "totalChunks" | "currentChunks" | "staleChunks" | "pendingChunks" | "failedChunks"
    >
  >;
}
