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
  PropertyImageSnapshot
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

    return {
      propertyId,
      images: await this.images.listByPropertyId(tenantId, propertyId)
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
}
