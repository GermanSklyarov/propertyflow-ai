import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateKnowledgeDocumentRequest,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentSearchRequest,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  type KnowledgeDocumentRepository
} from "../domain/knowledge-document.repository.js";

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY) private readonly documents: KnowledgeDocumentRepository
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

  private normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  }
}
