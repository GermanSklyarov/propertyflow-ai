import type { Money, PropertySnapshot, PropertyStatus } from "@propertyflow/domain";
import type { PropertyPriceHistoryPoint, PropertySearchRequest } from "@propertyflow/contracts";

export const PROPERTY_REPOSITORY = Symbol("PROPERTY_REPOSITORY");

export interface PropertyRepository {
  save(property: PropertySnapshot): Promise<PropertySnapshot>;
  findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null>;
  updateListingText(
    tenantId: string,
    propertyId: string,
    title: string,
    description: string
  ): Promise<PropertySnapshot | null>;
  updateAmenities(tenantId: string, propertyId: string, amenities: string[]): Promise<PropertySnapshot | null>;
  updatePrice(tenantId: string, propertyId: string, price: Money): Promise<PropertySnapshot | null>;
  updateStatus(tenantId: string, propertyId: string, status: PropertyStatus): Promise<PropertySnapshot | null>;
  list(tenantId: string): Promise<PropertySnapshot[]>;
  search(tenantId: string, filters: PropertySearchRequest): Promise<PropertySnapshot[]>;
  addPriceHistoryPoint(
    tenantId: string,
    propertyId: string,
    price: Money,
    source: PropertyPriceHistoryPoint["source"],
    effectiveDate: string
  ): Promise<PropertyPriceHistoryPoint>;
  listPriceHistory(tenantId: string, propertyId: string): Promise<PropertyPriceHistoryPoint[]>;
}
