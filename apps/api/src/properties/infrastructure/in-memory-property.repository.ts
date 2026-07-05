import { Injectable } from "@nestjs/common";
import type { PropertyPriceHistoryPoint, PropertySearchRequest } from "@propertyflow/contracts";
import type { Money, PropertySnapshot, PropertyStatus } from "@propertyflow/domain";
import type { PropertyRepository } from "../domain/property.repository.js";

@Injectable()
export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly properties = new Map<string, PropertySnapshot>();
  private readonly priceHistory = new Map<string, PropertyPriceHistoryPoint[]>();

  async save(property: PropertySnapshot): Promise<PropertySnapshot> {
    this.properties.set(this.key(property.tenantId, property.id), property);
    return property;
  }

  async findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    return this.properties.get(this.key(tenantId, propertyId)) ?? null;
  }

  async updateListingText(
    tenantId: string,
    propertyId: string,
    title: string,
    description: string
  ): Promise<PropertySnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const property = this.properties.get(key);

    if (!property) {
      return null;
    }

    const updated = {
      ...property,
      title,
      description,
      updatedAt: new Date().toISOString()
    };

    this.properties.set(key, updated);

    return updated;
  }

  async updateAmenities(tenantId: string, propertyId: string, amenities: string[]): Promise<PropertySnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const property = this.properties.get(key);

    if (!property) {
      return null;
    }

    const updated = {
      ...property,
      amenities,
      updatedAt: new Date().toISOString()
    };

    this.properties.set(key, updated);

    return updated;
  }

  async updatePrice(tenantId: string, propertyId: string, price: Money): Promise<PropertySnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const property = this.properties.get(key);

    if (!property) {
      return null;
    }

    const updated = {
      ...property,
      price,
      updatedAt: new Date().toISOString()
    };

    this.properties.set(key, updated);

    return updated;
  }

  async updateStatus(
    tenantId: string,
    propertyId: string,
    status: PropertyStatus
  ): Promise<PropertySnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const property = this.properties.get(key);

    if (!property) {
      return null;
    }

    const updated = {
      ...property,
      status,
      updatedAt: new Date().toISOString()
    };

    this.properties.set(key, updated);

    return updated;
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

  async addPriceHistoryPoint(
    tenantId: string,
    propertyId: string,
    price: Money,
    source: PropertyPriceHistoryPoint["source"],
    effectiveDate: string
  ): Promise<PropertyPriceHistoryPoint> {
    const point: PropertyPriceHistoryPoint = {
      effectiveDate,
      price,
      source
    };
    const key = this.key(tenantId, propertyId);
    const existing = this.priceHistory.get(key) ?? [];

    this.priceHistory.set(key, [...existing, point]);

    return point;
  }

  async listPriceHistory(tenantId: string, propertyId: string): Promise<PropertyPriceHistoryPoint[]> {
    return this.priceHistory.get(this.key(tenantId, propertyId)) ?? [];
  }

  private key(tenantId: string, propertyId: string): string {
    return `${tenantId}:${propertyId}`;
  }
}
