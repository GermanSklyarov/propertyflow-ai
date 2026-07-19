import type { AddPropertyImageRequest, PropertyImageSnapshot } from "@propertyflow/contracts";

export const PROPERTY_IMAGES_REPOSITORY = Symbol("PROPERTY_IMAGES_REPOSITORY");

export interface AddPropertyImageInput extends AddPropertyImageRequest {
  tenantId: string;
  propertyId: string;
}

export interface PropertyImagesRepository {
  add(input: AddPropertyImageInput): Promise<PropertyImageSnapshot>;
  createDeleteConfirmation(input: PropertyImageDeleteConfirmationInput): Promise<void>;
  findById(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null>;
  findByIdIncludingDeleted(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null>;
  listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]>;
  listDeletedByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]>;
  makeCover(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null>;
  consumeDeleteConfirmation(input: ConsumePropertyImageDeleteConfirmationInput): Promise<boolean>;
  remove(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null>;
  restore(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null>;
}

export interface PropertyImageDeleteConfirmationInput {
  tenantId: string;
  propertyId: string;
  imageId: string;
  tokenHash: string;
  requestedByUserId?: string;
  expiresAt: Date;
}

export interface ConsumePropertyImageDeleteConfirmationInput {
  tenantId: string;
  propertyId: string;
  imageId: string;
  tokenHash: string;
}
