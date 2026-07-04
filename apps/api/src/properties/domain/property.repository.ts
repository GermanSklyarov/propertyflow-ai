import type { Money, PropertySnapshot } from "@propertyflow/domain";
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
