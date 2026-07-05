import { Injectable } from "@nestjs/common";
import type { PropertyImageSnapshot } from "@propertyflow/contracts";
import type { AddPropertyImageInput, PropertyImagesRepository } from "../domain/property-images.repository.js";

@Injectable()
export class InMemoryPropertyImagesRepository implements PropertyImagesRepository {
  private readonly images = new Map<string, PropertyImageSnapshot[]>();

  async add(input: AddPropertyImageInput): Promise<PropertyImageSnapshot> {
    const key = this.key(input.tenantId, input.propertyId);
    const existing = this.images.get(key) ?? [];
    const image: PropertyImageSnapshot = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      imageUrl: input.imageUrl,
      bucket: input.bucket,
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename,
      caption: input.caption,
      position: input.position ?? existing.length,
      createdAt: new Date().toISOString()
    };

    this.images.set(key, [...existing, image]);

    return image;
  }

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]> {
    return [...(this.images.get(this.key(tenantId, propertyId)) ?? [])].sort(
      (left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt)
    );
  }

  async remove(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const existing = this.images.get(key) ?? [];
    const image = existing.find((item) => item.id === imageId);

    if (!image) {
      return null;
    }

    this.images.set(
      key,
      existing.filter((item) => item.id !== imageId)
    );

    return image;
  }

  private key(tenantId: string, propertyId: string): string {
    return `${tenantId}:${propertyId}`;
  }
}
