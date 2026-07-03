import type { PropertySnapshot } from "@propertyflow/domain";

export const PROPERTY_REPOSITORY = Symbol("PROPERTY_REPOSITORY");

export interface PropertyRepository {
  save(property: PropertySnapshot): Promise<PropertySnapshot>;
  findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null>;
  list(tenantId: string): Promise<PropertySnapshot[]>;
}

