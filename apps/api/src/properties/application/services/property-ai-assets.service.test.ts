import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { GeneratedPropertyDescription, PropertyImageAnalysisResult, RequestUser } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import type { PropertyAiAssetsRepository } from "../../domain/property-ai-assets.repository.js";
import type { PropertyRepository } from "../../domain/property.repository.js";
import { PropertyAiAssetsService } from "./property-ai-assets.service.js";

const user = { id: "manager-1", role: "manager", tenantId: "tenant-1" } satisfies RequestUser;
const property = { id: "property-1", amenities: [] } as unknown as PropertySnapshot;
const descriptionAsset = {
  createdAt: "2026-07-14T00:00:00.000Z",
  description: "Edited copy",
  id: "description-1",
  locale: "en",
  propertyId: "property-1",
  reviewStatus: "draft",
  source: "ai-worker-v1",
  title: "Edited title"
} satisfies GeneratedPropertyDescription;
const imageAsset = {
  confidence: 0.82,
  createdAt: "2026-07-14T00:00:00.000Z",
  detectedFeatures: ["Pool"],
  id: "image-analysis-1",
  imageUrl: "https://example.com/photo.jpg",
  propertyId: "property-1",
  reviewStatus: "draft"
} satisfies PropertyImageAnalysisResult;

function createService(repositoryOverrides: Partial<PropertyAiAssetsRepository> = {}) {
  const properties = {
    findById: vi.fn().mockResolvedValue(property)
  } as unknown as PropertyRepository;
  const aiAssets = {
    findImageAnalysisById: vi.fn().mockResolvedValue(imageAsset),
    updateDescription: vi.fn().mockResolvedValue(descriptionAsset),
    updateImageAnalysis: vi.fn().mockResolvedValue(imageAsset),
    ...repositoryOverrides
  } as unknown as PropertyAiAssetsRepository;

  return {
    aiAssets,
    properties,
    service: new PropertyAiAssetsService(properties, aiAssets)
  };
}

describe("PropertyAiAssetsService", () => {
  it("trims edited description assets before saving", async () => {
    const { aiAssets, service } = createService();

    await expect(
      service.updateDescription(
        "tenant-1",
        "property-1",
        "description-1",
        {
          description: "  Edited copy  ",
          title: "  Edited title  "
        },
        user
      )
    ).resolves.toBe(descriptionAsset);

    expect(aiAssets.updateDescription).toHaveBeenCalledWith(
      "tenant-1",
      "property-1",
      "description-1",
      {
        description: "Edited copy",
        title: "Edited title"
      },
      user
    );
  });

  it("rejects empty edited description assets", async () => {
    const { service } = createService();

    await expect(
      service.updateDescription(
        "tenant-1",
        "property-1",
        "description-1",
        {
          description: " ",
          title: "Edited title"
        },
        user
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalizes image analysis features before saving", async () => {
    const { aiAssets, service } = createService();

    await expect(
      service.updateImageAnalysis(
        "tenant-1",
        "property-1",
        "image-analysis-1",
        {
          detectedFeatures: [" swimming pool ", "Pool", "Air-con", "air conditioning"]
        },
        user
      )
    ).resolves.toBe(imageAsset);

    expect(aiAssets.updateImageAnalysis).toHaveBeenCalledWith(
      "tenant-1",
      "property-1",
      "image-analysis-1",
      {
        confidence: 0.82,
        detectedFeatures: ["swimming pool", "Air-con"]
      },
      user
    );
  });

  it("throws when an edited image analysis asset is missing", async () => {
    const { service } = createService({
      findImageAnalysisById: vi.fn().mockResolvedValue(null)
    });

    await expect(
      service.updateImageAnalysis(
        "tenant-1",
        "property-1",
        "missing",
        {
          detectedFeatures: ["pool"]
        },
        user
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
