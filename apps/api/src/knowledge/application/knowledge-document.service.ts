import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateKnowledgeDocumentUploadRequest,
  CreateKnowledgeDocumentUploadResponse,
  CreateKnowledgeDocumentRequest,
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentSearchRequest,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";
import { ObjectStorageService } from "../../storage/object-storage.service.js";
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  type KnowledgeDocumentRepository
} from "../domain/knowledge-document.repository.js";

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY) private readonly documents: KnowledgeDocumentRepository,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService
  ) {}

  create(tenantId: string, request: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentSnapshot> {
    return this.documents.save(tenantId, {
      ...request,
      tags: this.normalizeTags(request.tags ?? [])
    });
  }

  async search(tenantId: string, request: KnowledgeDocumentSearchRequest): Promise<KnowledgeDocumentListResponse> {
    const items = await this.documents.search(tenantId, request);

    return {
      items,
      total: items.length
    };
  }

  async searchChunks(tenantId: string, request: KnowledgeChunkSearchRequest): Promise<KnowledgeChunkSearchResponse> {
    const items = await this.documents.searchChunks(tenantId, request);

    return {
      items,
      total: items.length,
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
}
