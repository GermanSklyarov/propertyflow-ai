import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateKnowledgeDocumentRequest,
  CreateKnowledgeDocumentUploadRequest,
  CreateKnowledgeDocumentUploadResponse,
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentSnapshot,
  KnowledgeEmbeddingHealthSnapshot
} from "@propertyflow/contracts";
import { KnowledgeEmbeddingGenerator } from "@propertyflow/domain";
import { ObjectStorageService } from "../../storage/object-storage.service.js";
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  type KnowledgeDocumentRepository,
  type KnowledgeDocumentTagFilterRequest
} from "../domain/knowledge-document.repository.js";

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY) private readonly documents: KnowledgeDocumentRepository,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
    @Inject(KnowledgeEmbeddingGenerator) private readonly embeddings: KnowledgeEmbeddingGenerator
  ) {}

  create(tenantId: string, request: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentSnapshot> {
    return this.documents.save(tenantId, {
      ...request,
      tags: this.normalizeTags(request.tags ?? [])
    });
  }

  async search(tenantId: string, request: KnowledgeDocumentTagFilterRequest): Promise<KnowledgeDocumentListResponse> {
    const items = await this.documents.search(tenantId, request);

    return {
      items,
      total: items.length
    };
  }

  async searchChunks(tenantId: string, request: KnowledgeChunkSearchRequest): Promise<KnowledgeChunkSearchResponse> {
    const queryEmbedding = await this.embedQueryWithFallback(request.query);
    const items = await this.documents.searchChunks(tenantId, request, queryEmbedding);

    return {
      items,
      total: items.length,
      retrieval: "hybrid-chunks-v1",
      generatedAt: new Date().toISOString()
    };
  }

  async embeddingHealth(tenantId: string): Promise<KnowledgeEmbeddingHealthSnapshot> {
    const stats = await this.documents.summarizeChunkEmbeddingHealth(tenantId, this.embeddings.modelKey());
    const unembeddedChunks = stats.staleChunks + stats.pendingChunks + stats.failedChunks;

    return {
      ...stats,
      tenantId,
      targetProvider: this.embeddings.provider(),
      targetModel: this.embeddings.model(),
      targetModelKey: this.embeddings.modelKey(),
      targetDimensions: this.embeddings.dimensions(),
      unembeddedChunks,
      ready: stats.totalChunks > 0 && unembeddedChunks === 0,
      retrieval: "hybrid-chunks-v1",
      generatedAt: new Date().toISOString()
    };
  }

  async createUploadUrl(
    tenantId: string,
    request: CreateKnowledgeDocumentUploadRequest
  ): Promise<CreateKnowledgeDocumentUploadResponse> {
    const objectKey = [
      "tenants",
      this.safePathSegment(tenantId),
      "knowledge",
      `${crypto.randomUUID()}-${this.safeFilename(request.filename)}`
    ].join("/");
    const upload = await this.storage.createPresignedPutUrl({
      objectKey,
      contentType: request.mimeType,
      expiresInSeconds: 900
    });
    const read = await this.storage.createPresignedGetUrl({
      objectKey,
      expiresInSeconds: 3600
    });

    return {
      ...upload,
      objectUrl: read.objectUrl
    };
  }

  private normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  }

  private safePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, "-");
  }

  private safeFilename(filename: string): string {
    const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "-");

    return normalized || "knowledge-source";
  }

  private async embedQueryWithFallback(query: string) {
    try {
      return await this.embeddings.embed(query, "query");
    } catch {
      return this.embeddings.localFallback(query);
    }
  }
}
