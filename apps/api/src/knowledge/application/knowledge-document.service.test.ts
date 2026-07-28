import { describe, expect, it, vi } from "vitest";
import { KnowledgeEmbeddingGenerator, type KnowledgeEmbeddingResult } from "@propertyflow/domain";
import type { ObjectStorageService } from "../../storage/object-storage.service.js";
import type { KnowledgeDocumentRepository } from "../domain/knowledge-document.repository.js";
import { KnowledgeDocumentService } from "./knowledge-document.service.js";

function createService() {
  const documents = {
    save: vi.fn(),
    search: vi.fn(),
    searchChunks: vi.fn()
  } as unknown as KnowledgeDocumentRepository;
  const storage = {
    createPresignedGetUrl: vi.fn().mockResolvedValue({
      bucket: "propertyflow-dev",
      expiresInSeconds: 3600,
      objectKey: "tenants/demo-agency/knowledge/source.pdf",
      objectUrl: "https://storage.example.com/read-source.pdf"
    }),
    createPresignedPutUrl: vi.fn().mockResolvedValue({
      bucket: "propertyflow-dev",
      expiresInSeconds: 900,
      headers: { "content-type": "application/pdf" },
      method: "PUT",
      objectKey: "tenants/demo-agency/knowledge/source.pdf",
      uploadUrl: "https://storage.example.com/write-source.pdf"
    })
  } as unknown as ObjectStorageService;
  const queryEmbedding: KnowledgeEmbeddingResult = {
    vector: [0.25, 0.75],
    provider: "gemini",
    model: "text-embedding-004",
    dimensions: 2,
    modelKey: "gemini:text-embedding-004",
    isRemote: true
  };
  const fallbackEmbedding: KnowledgeEmbeddingResult = {
    vector: [1, 0],
    provider: "local-hash",
    model: "local-hash-16",
    dimensions: 2,
    modelKey: "local-hash:local-hash-16",
    isRemote: false
  };
  const embeddings = {
    embed: vi.fn().mockResolvedValue(queryEmbedding),
    localFallback: vi.fn().mockReturnValue(fallbackEmbedding)
  } as unknown as KnowledgeEmbeddingGenerator;

  return {
    documents,
    embeddings,
    fallbackEmbedding,
    queryEmbedding,
    service: new KnowledgeDocumentService(documents, storage, embeddings),
    storage
  };
}

describe("KnowledgeDocumentService", () => {
  it("creates tenant-scoped upload URLs for source documents", async () => {
    const { service, storage } = createService();

    await expect(
      service.createUploadUrl("demo agency/one", {
        filename: "Developer Brochure (Final).pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_024_000
      })
    ).resolves.toEqual({
      bucket: "propertyflow-dev",
      expiresInSeconds: 900,
      headers: { "content-type": "application/pdf" },
      method: "PUT",
      objectKey: "tenants/demo-agency/knowledge/source.pdf",
      objectUrl: "https://storage.example.com/read-source.pdf",
      uploadUrl: "https://storage.example.com/write-source.pdf"
    });

    expect(storage.createPresignedPutUrl).toHaveBeenCalledWith({
      contentType: "application/pdf",
      expiresInSeconds: 900,
      objectKey: expect.stringMatching(
        /^tenants\/demo-agency-one\/knowledge\/[a-f0-9-]+-Developer-Brochure--Final-.pdf$/
      )
    });
    expect(storage.createPresignedGetUrl).toHaveBeenCalledWith({
      expiresInSeconds: 3600,
      objectKey: expect.stringMatching(
        /^tenants\/demo-agency-one\/knowledge\/[a-f0-9-]+-Developer-Brochure--Final-.pdf$/
      )
    });
  });

  it("passes a query embedding to chunk search", async () => {
    const { documents, embeddings, queryEmbedding, service } = createService();
    vi.mocked(documents.searchChunks).mockResolvedValue([]);

    await expect(service.searchChunks("tenant-1", { query: "sea view condo", limit: 3 })).resolves.toEqual({
      generatedAt: expect.any(String),
      items: [],
      retrieval: "hybrid-chunks-v1",
      total: 0
    });

    expect(embeddings.embed).toHaveBeenCalledWith("sea view condo", "query");
    expect(documents.searchChunks).toHaveBeenCalledWith("tenant-1", { query: "sea view condo", limit: 3 }, queryEmbedding);
  });

  it("falls back to local query embeddings when the remote provider fails", async () => {
    const { documents, embeddings, fallbackEmbedding, service } = createService();
    vi.mocked(embeddings.embed).mockRejectedValue(new Error("Gemini timeout"));
    vi.mocked(documents.searchChunks).mockResolvedValue([]);

    await service.searchChunks("tenant-1", { query: "thai visa guide" });

    expect(embeddings.localFallback).toHaveBeenCalledWith("thai visa guide");
    expect(documents.searchChunks).toHaveBeenCalledWith("tenant-1", { query: "thai visa guide" }, fallbackEmbedding);
  });
});
