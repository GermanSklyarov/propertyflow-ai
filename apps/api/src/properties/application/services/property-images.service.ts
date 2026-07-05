import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AddPropertyImageRequest,
  ConfirmPropertyImageUploadRequest,
  CreatePropertyImageUploadRequest,
  CreatePropertyImageUploadResponse,
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

  async removeImage(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

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
}
