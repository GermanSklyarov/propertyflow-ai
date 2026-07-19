import { Injectable } from "@nestjs/common";
import type { PropertyImageSnapshot } from "@propertyflow/contracts";
import type {
  AddPropertyImageInput,
  ConsumePropertyImageDeleteConfirmationInput,
  PropertyImageDeleteConfirmationInput,
  PropertyImagesRepository
} from "../domain/property-images.repository.js";

interface InMemoryDeleteConfirmation {
  input: PropertyImageDeleteConfirmationInput;
  consumedAt?: string;
}

@Injectable()
export class InMemoryPropertyImagesRepository implements PropertyImagesRepository {
  private readonly images = new Map<string, PropertyImageSnapshot[]>();
  private readonly confirmations = new Map<string, InMemoryDeleteConfirmation>();

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

  async createDeleteConfirmation(input: PropertyImageDeleteConfirmationInput): Promise<void> {
    this.confirmations.set(input.tokenHash, { input });
  }

  async findById(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    return (
      (this.images.get(this.key(tenantId, propertyId)) ?? []).find(
        (item) => item.id === imageId && !item.deletedAt
      ) ?? null
    );
  }

  async findByIdIncludingDeleted(
    tenantId: string,
    propertyId: string,
    imageId: string
  ): Promise<PropertyImageSnapshot | null> {
    return (this.images.get(this.key(tenantId, propertyId)) ?? []).find((item) => item.id === imageId) ?? null;
  }

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]> {
    return [...(this.images.get(this.key(tenantId, propertyId)) ?? [])]
      .filter((image) => !image.deletedAt)
      .sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt));
  }

  async listDeletedByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]> {
    return [...(this.images.get(this.key(tenantId, propertyId)) ?? [])]
      .filter((image) => image.deletedAt)
      .sort(
        (left, right) =>
          (right.deletedAt ?? "").localeCompare(left.deletedAt ?? "") ||
          left.position - right.position ||
          left.createdAt.localeCompare(right.createdAt)
      );
  }

  async consumeDeleteConfirmation(input: ConsumePropertyImageDeleteConfirmationInput): Promise<boolean> {
    const confirmation = this.confirmations.get(input.tokenHash);
    const now = new Date();

    if (
      !confirmation ||
      confirmation.consumedAt ||
      confirmation.input.tenantId !== input.tenantId ||
      confirmation.input.propertyId !== input.propertyId ||
      confirmation.input.imageId !== input.imageId ||
      confirmation.input.expiresAt <= now
    ) {
      return false;
    }

    confirmation.consumedAt = now.toISOString();
    return true;
  }

  async remove(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const existing = this.images.get(key) ?? [];
    const image = existing.find((item) => item.id === imageId);

    if (!image || image.deletedAt) {
      return null;
    }

    image.deletedAt = new Date().toISOString();

    return image;
  }

  async restore(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const image = (this.images.get(this.key(tenantId, propertyId)) ?? []).find(
      (item) => item.id === imageId && item.deletedAt
    );

    if (!image) {
      return null;
    }

    image.deletedAt = undefined;
    return image;
  }

  async makeCover(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const existing = this.images.get(this.key(tenantId, propertyId)) ?? [];
    const active = existing
      .filter((image) => !image.deletedAt)
      .sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt));
    const selected = active.find((image) => image.id === imageId);

    if (!selected) {
      return null;
    }

    const ordered = [selected, ...active.filter((image) => image.id !== imageId)];

    ordered.forEach((image, position) => {
      image.position = position;
    });

    return selected;
  }

  async reorder(tenantId: string, propertyId: string, imageIds: string[]): Promise<PropertyImageSnapshot[] | null> {
    const existing = this.images.get(this.key(tenantId, propertyId)) ?? [];
    const active = existing
      .filter((image) => !image.deletedAt)
      .sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt));
    const activeById = new Map(active.map((image) => [image.id, image]));

    if (imageIds.some((imageId) => !activeById.has(imageId))) {
      return null;
    }

    const ordered = [
      ...imageIds.map((imageId) => activeById.get(imageId)!),
      ...active.filter((image) => !imageIds.includes(image.id))
    ];

    ordered.forEach((image, position) => {
      image.position = position;
    });

    return ordered;
  }

  private key(tenantId: string, propertyId: string): string {
    return `${tenantId}:${propertyId}`;
  }
}
