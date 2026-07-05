import type {
  CreateKnowledgeDocumentRequest,
  KnowledgeChunkSearchRequest,
  KnowledgeDocumentChunkSnapshot,
  KnowledgeDocumentSearchRequest,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";

export const KNOWLEDGE_DOCUMENT_REPOSITORY = Symbol("KNOWLEDGE_DOCUMENT_REPOSITORY");

export interface KnowledgeDocumentRepository {
  save(tenantId: string, request: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentSnapshot>;
  search(tenantId: string, request: KnowledgeDocumentSearchRequest): Promise<KnowledgeDocumentSnapshot[]>;
  searchChunks(tenantId: string, request: KnowledgeChunkSearchRequest): Promise<KnowledgeDocumentChunkSnapshot[]>;
}
