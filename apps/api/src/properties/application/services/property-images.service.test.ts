import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PropertyImageSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import type { ObjectStorageService } from "../../../storage/object-storage.service.js";
import type { PropertyImagesRepository } from "../../domain/property-images.repository.js";
import type { PropertyRepository } from "../../domain/property.repository.js";
import { PropertyImagesService } from "./property-images.service.js";

const property = {
  id: "property-1",
  tenantId: "tenant-1"
} as unknown as PropertySnapshot;

const activeImage = {
  createdAt: "2026-07-19T00:00:00.000Z",
  id: "image-active",
  imageUrl: "https://example.com/active.jpg",
  position: 0,
  propertyId: "property-1",
  tenantId: "tenant-1"
} satisfies PropertyImageSnapshot;

const deletedImage = {
  createdAt: "2026-07-18T00:00:00.000Z",
  deletedAt: "2026-07-19T01:00:00.000Z",
  id: "image-deleted",
  imageUrl: "https://example.com/deleted.jpg",
  position: 1,
  propertyId: "property-1",
  tenantId: "tenant-1"
} satisfies PropertyImageSnapshot;

const storedDeletedImage = {
  ...deletedImage,
  bucket: "propertyflow-dev",
  objectKey: "tenants/tenant-1/properties/property-1/images/deleted.jpg"
} satisfies PropertyImageSnapshot;

function createService(repositoryOverrides: Partial<PropertyImagesRepository> = {}) {
  const properties = {
    findById: vi.fn().mockResolvedValue(property)
  } as unknown as PropertyRepository;
  const images = {
    findByIdIncludingDeleted: vi.fn().mockResolvedValue(storedDeletedImage),
    listByPropertyId: vi.fn().mockResolvedValue([activeImage]),
    listDeletedByPropertyId: vi.fn().mockResolvedValue([deletedImage]),
    makeCover: vi.fn().mockResolvedValue({ ...activeImage, id: "image-promoted", position: 0 }),
    reorder: vi.fn().mockResolvedValue([
      { ...activeImage, id: "image-2", position: 0 },
      { ...activeImage, id: "image-1", position: 1 }
    ]),
    restore: vi.fn().mockResolvedValue({ ...deletedImage, deletedAt: undefined }),
    ...repositoryOverrides
  } as unknown as PropertyImagesRepository;
  const storage = {
    createPresignedGetUrl: vi.fn().mockResolvedValue({
      expiresInSeconds: 300,
      objectUrl: "https://storage.example.com/signed-deleted.jpg"
    })
  } as unknown as ObjectStorageService;

  return {
    images,
    properties,
    service: new PropertyImagesService(properties, images, storage)
  };
}

describe("PropertyImagesService", () => {
  it("returns active and recently deleted images in the gallery response", async () => {
    const { images, service } = createService();

    await expect(service.getGallery("tenant-1", "property-1")).resolves.toEqual({
      propertyId: "property-1",
      images: [activeImage],
      deletedImages: [deletedImage]
    });

    expect(images.listByPropertyId).toHaveBeenCalledWith("tenant-1", "property-1");
    expect(images.listDeletedByPropertyId).toHaveBeenCalledWith("tenant-1", "property-1");
  });

  it("restores a deleted image so it can return to the active gallery", async () => {
    const { images, service } = createService();

    await expect(service.restoreImage("tenant-1", "property-1", "image-deleted")).resolves.toMatchObject({
      id: "image-deleted",
      deletedAt: undefined
    });

    expect(images.restore).toHaveBeenCalledWith("tenant-1", "property-1", "image-deleted");
  });

  it("can create read URLs for recently deleted images", async () => {
    const { images, service } = createService();

    await expect(service.createImageReadUrl("tenant-1", "property-1", "image-deleted")).resolves.toEqual({
      expiresInSeconds: 300,
      image: storedDeletedImage,
      objectUrl: "https://storage.example.com/signed-deleted.jpg"
    });

    expect(images.findByIdIncludingDeleted).toHaveBeenCalledWith("tenant-1", "property-1", "image-deleted");
  });

  it("promotes an active image to the cover position", async () => {
    const { images, service } = createService();

    await expect(service.makeCover("tenant-1", "property-1", "image-promoted")).resolves.toMatchObject({
      id: "image-promoted",
      position: 0
    });

    expect(images.makeCover).toHaveBeenCalledWith("tenant-1", "property-1", "image-promoted");
  });

  it("rejects cover changes for images outside the active gallery", async () => {
    const { service } = createService({
      makeCover: vi.fn().mockResolvedValue(null)
    });

    await expect(service.makeCover("tenant-1", "property-1", "image-deleted")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("persists a unique active image order and returns the refreshed gallery", async () => {
    const { images, service } = createService();

    await expect(
      service.reorderImages("tenant-1", "property-1", {
        imageIds: ["image-2", "image-1"]
      })
    ).resolves.toEqual({
      propertyId: "property-1",
      images: [
        { ...activeImage, id: "image-2", position: 0 },
        { ...activeImage, id: "image-1", position: 1 }
      ],
      deletedImages: [deletedImage]
    });

    expect(images.reorder).toHaveBeenCalledWith("tenant-1", "property-1", ["image-2", "image-1"]);
  });

  it("rejects reorder payloads with duplicate image ids", async () => {
    const { service } = createService();

    await expect(
      service.reorderImages("tenant-1", "property-1", {
        imageIds: ["image-1", "image-1"]
      })
    ).rejects.toBeInstanceOf(Error);
  });

  it("rejects gallery access for unknown properties", async () => {
    const { properties, service } = createService();

    vi.mocked(properties.findById).mockResolvedValueOnce(null);

    await expect(service.getGallery("tenant-1", "missing-property")).rejects.toBeInstanceOf(NotFoundException);
  });
});
