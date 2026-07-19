import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AddPropertyImageRequest,
  ConfirmPropertyImageDeleteRequest,
  ConfirmPropertyImageUploadRequest,
  CreatePropertyImageUploadRequest,
  CreatePropertyImageUploadResponse,
  PropertyImageDeletePreviewResponse,
  PropertyImageGalleryResponse,
  PropertyImageSnapshot,
  ReorderPropertyImagesRequest
} from "@propertyflow/contracts";
import { ObjectStorageService } from "../../../storage/object-storage.service.js";
import { PROPERTY_IMAGES_REPOSITORY, type PropertyImagesRepository } from "../../domain/property-images.repository.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class PropertyImagesService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PROPERTY_IMAGES_REPOSITORY) private readonly images: PropertyImagesRepository,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService
  ) {}

  async getGallery(tenantId: string, propertyId: string): Promise<PropertyImageGalleryResponse> {
    await this.ensurePropertyExists(tenantId, propertyId);
    const [images, deletedImages] = await Promise.all([
      this.images.listByPropertyId(tenantId, propertyId),
      this.images.listDeletedByPropertyId(tenantId, propertyId)
    ]);

    return {
      propertyId,
      images,
      deletedImages
    };
  }

  async addImage(
    tenantId: string,
    propertyId: string,
    request: AddPropertyImageRequest
  ): Promise<PropertyImageSnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

    return this.images.add({
      tenantId,
      propertyId,
      ...request
    });
  }

  async createUploadUrl(
    tenantId: string,
    propertyId: string,
    request: CreatePropertyImageUploadRequest
  ): Promise<CreatePropertyImageUploadResponse> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const objectKey = [
      "tenants",
      this.safePathSegment(tenantId),
      "properties",
      propertyId,
      "images",
      `${crypto.randomUUID()}-${this.safeFilename(request.filename)}`
    ].join("/");

    return this.storage.createPresignedPutUrl({
      objectKey,
      contentType: request.mimeType
    });
  }

  async confirmUpload(
    tenantId: string,
    propertyId: string,
    request: ConfirmPropertyImageUploadRequest
  ): Promise<PropertyImageSnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const bucket = request.bucket ?? this.storage.defaultBucket();

    return this.images.add({
      tenantId,
      propertyId,
      imageUrl: this.storage.publicObjectUrl(bucket, request.objectKey),
      bucket,
      objectKey: request.objectKey,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      originalFilename: request.originalFilename,
      caption: request.caption,
      position: request.position
    });
  }

  async createDeletePreview(
    tenantId: string,
    propertyId: string,
    imageId: string,
    requestedByUserId?: string
  ): Promise<PropertyImageDeletePreviewResponse> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const image = await this.images.findById(tenantId, propertyId, imageId);

    if (!image) {
      throw new NotFoundException("Property image not found");
    }

    const confirmationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.images.createDeleteConfirmation({
      tenantId,
      propertyId,
      imageId,
      tokenHash: this.hashToken(confirmationToken),
      requestedByUserId,
      expiresAt
    });

    return {
      propertyId,
      image,
      confirmationToken,
      expiresAt: expiresAt.toISOString(),
      warnings: [
        "This token authorizes a destructive image delete for the exact tenant, property, and image.",
        "Do not pass this token to autonomous AI tools without an explicit human confirmation step."
      ]
    };
  }

  async removeImage(
    tenantId: string,
    propertyId: string,
    imageId: string,
    request: ConfirmPropertyImageDeleteRequest
  ): Promise<PropertyImageSnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

    if (!request.confirmationToken) {
      throw new BadRequestException("Valid image delete confirmation token is required");
    }

    const confirmed = await this.images.consumeDeleteConfirmation({
      tenantId,
      propertyId,
      imageId,
      tokenHash: this.hashToken(request.confirmationToken)
    });

    if (!confirmed) {
      throw new BadRequestException("Valid image delete confirmation token is required");
    }

    const image = await this.images.remove(tenantId, propertyId, imageId);

    if (!image) {
      throw new NotFoundException("Property image not found");
    }

    return image;
  }

  async restoreImage(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const image = await this.images.restore(tenantId, propertyId, imageId);

    if (!image) {
      throw new NotFoundException("Deleted property image not found");
    }

    return image;
  }

  async makeCover(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const image = await this.images.makeCover(tenantId, propertyId, imageId);

    if (!image) {
      throw new NotFoundException("Active property image not found");
    }

    return image;
  }

  async reorderImages(
    tenantId: string,
    propertyId: string,
    request: ReorderPropertyImagesRequest
  ): Promise<PropertyImageGalleryResponse> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const imageIds = this.uniqueImageIds(request.imageIds);
    const images = await this.images.reorder(tenantId, propertyId, imageIds);

    if (!images) {
      throw new BadRequestException("Image order contains unknown or inactive property images");
    }

    return {
      propertyId,
      images,
      deletedImages: await this.images.listDeletedByPropertyId(tenantId, propertyId)
    };
  }

  async createImageReadUrl(
    tenantId: string,
    propertyId: string,
    imageId: string
  ): Promise<{ image: PropertyImageSnapshot; objectUrl: string; expiresInSeconds: number }> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const image = await this.images.findByIdIncludingDeleted(tenantId, propertyId, imageId);

    if (!image) {
      throw new NotFoundException("Property image not found");
    }

    if (!image.objectKey) {
      throw new BadRequestException("Property image is not stored in object storage");
    }

    const signed = await this.storage.createPresignedGetUrl({
      bucket: image.bucket,
      objectKey: image.objectKey
    });

    return {
      image,
      objectUrl: signed.objectUrl,
      expiresInSeconds: signed.expiresInSeconds
    };
  }

  private async ensurePropertyExists(tenantId: string, propertyId: string): Promise<void> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }
  }

  private safePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, "-");
  }

  private safeFilename(filename: string): string {
    const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "-");

    return normalized || "image";
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private uniqueImageIds(imageIds: string[]): string[] {
    const normalized = imageIds.map((imageId) => imageId.trim()).filter(Boolean);
    const unique = new Set(normalized);

    if (!normalized.length || unique.size !== normalized.length) {
      throw new BadRequestException("Image order must include unique image ids");
    }

    return normalized;
  }
}
