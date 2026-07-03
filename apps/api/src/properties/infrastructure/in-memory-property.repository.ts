import { Injectable } from "@nestjs/common";
import type { PropertySearchRequest } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import type { PropertyRepository } from "../domain/property.repository.js";

@Injectable()
export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly properties = new Map<string, PropertySnapshot>();

  async save(property: PropertySnapshot): Promise<PropertySnapshot> {
    this.properties.set(this.key(property.tenantId, property.id), property);
    return property;
  }

  async findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    return this.properties.get(this.key(tenantId, propertyId)) ?? null;
  }

  async list(tenantId: string): Promise<PropertySnapshot[]> {
    return [...this.properties.values()].filter((property) => property.tenantId === tenantId);
  }

  async search(tenantId: string, filters: PropertySearchRequest): Promise<PropertySnapshot[]> {
    const properties = await this.list(tenantId);

    return properties.filter((property) => {
      if (filters.market && property.market !== filters.market) {
        return false;
      }

      if (filters.minPriceThb && property.price.amount < filters.minPriceThb) {
        return false;
      }

      if (filters.maxPriceThb && property.price.amount > filters.maxPriceThb) {
        return false;
      }

      if (filters.minBedrooms && property.bedrooms < filters.minBedrooms) {
        return false;
      }

      if (filters.minBathrooms && property.bathrooms < filters.minBathrooms) {
        return false;
      }

      if (filters.minAreaSqm && property.areaSqm < filters.minAreaSqm) {
        return false;
      }

      if (
        filters.maxBeachDistanceMeters &&
        (!property.beachDistanceMeters || property.beachDistanceMeters > filters.maxBeachDistanceMeters)
      ) {
        return false;
      }

      if (filters.requiredAmenities?.some((amenity) => !property.amenities.includes(amenity))) {
        return false;
      }

      return true;
    });
  }

  private key(tenantId: string, propertyId: string): string {
    return `${tenantId}:${propertyId}`;
  }
}
