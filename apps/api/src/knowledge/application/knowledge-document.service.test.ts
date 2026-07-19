import { describe, expect, it, vi } from "vitest";
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

  return {
    documents,
    service: new KnowledgeDocumentService(documents, storage),
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
});
