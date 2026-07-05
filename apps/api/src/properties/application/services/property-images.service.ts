import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AddPropertyImageRequest, PropertyImageGalleryResponse, PropertyImageSnapshot } from "@propertyflow/contracts";
import { PROPERTY_IMAGES_REPOSITORY, type PropertyImagesRepository } from "../../domain/property-images.repository.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class PropertyImagesService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PROPERTY_IMAGES_REPOSITORY) private readonly images: PropertyImagesRepository
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
}
