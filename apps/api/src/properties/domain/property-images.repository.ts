import type { AddPropertyImageRequest, PropertyImageSnapshot } from "@propertyflow/contracts";

export const PROPERTY_IMAGES_REPOSITORY = Symbol("PROPERTY_IMAGES_REPOSITORY");

export interface AddPropertyImageInput extends AddPropertyImageRequest {
  tenantId: string;
  propertyId: string;
}

export interface PropertyImagesRepository {
  add(input: AddPropertyImageInput): Promise<PropertyImageSnapshot>;
  listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]>;
  remove(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null>;
}
