import { Injectable } from "@nestjs/common";
import type {
  PropertyPriceHistoryPoint,
  PropertyProjectSearchRequest,
  PropertyProjectSearchResponse,
  PropertySearchRequest,
  UpdatePropertyProjectRequest
} from "@propertyflow/contracts";
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

  async updateProject(
    tenantId: string,
    propertyId: string,
    project: UpdatePropertyProjectRequest["project"]
  ): Promise<PropertySnapshot | null> {
    const key = this.key(tenantId, propertyId);
    const property = this.properties.get(key);

    if (!property) {
      return null;
    }

    const now = new Date().toISOString();
    const updated = {
      ...property,
      project: project
        ? {
            id: crypto.randomUUID(),
            tenantId,
            name: project.name,
            market: property.market,
            status: project.status ?? "completed",
            developer: project.developer,
            address: project.address,
            completionYear: project.completionYear,
            location: property.location,
            amenities: project.amenities ?? [],
            createdAt: now,
            updatedAt: now
          }
        : undefined,
      updatedAt: now
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

    const filteredProperties = properties.filter((property) => {
      if (filters.market && property.market !== filters.market) {
        return false;
      }

      if (
        filters.listingType &&
        property.listingType !== filters.listingType &&
        property.listingType !== "sale_or_rent"
      ) {
        return false;
      }

      if (filters.minPriceThb && property.price.amount < filters.minPriceThb) {
        return false;
      }

      if (filters.maxPriceThb && property.price.amount > filters.maxPriceThb) {
        return false;
      }

      if (filters.minMonthlyRentThb && (!property.rentalPriceMonthly || property.rentalPriceMonthly.amount < filters.minMonthlyRentThb)) {
        return false;
      }

      if (filters.maxMonthlyRentThb && (!property.rentalPriceMonthly || property.rentalPriceMonthly.amount > filters.maxMonthlyRentThb)) {
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

    const sortedProperties = this.sortProperties(filteredProperties, filters);
    const offset = filters.offset ?? 0;

    return filters.limit !== undefined
      ? sortedProperties.slice(offset, offset + filters.limit)
      : sortedProperties.slice(offset);
  }

  async searchProjects(tenantId: string, filters: PropertyProjectSearchRequest): Promise<PropertyProjectSearchResponse> {
    const query = filters.query ? normalizeProjectName(filters.query) : "";
    const projects = new Map<string, NonNullable<PropertySnapshot["project"]> & { listingCount: number }>();

    for (const property of await this.list(tenantId)) {
      if (!property.project || (filters.market && property.project.market !== filters.market)) {
        continue;
      }

      const normalized = normalizeProjectName(property.project.name);

      if (query && !normalized.includes(query)) {
        continue;
      }

      const current = projects.get(property.project.id);
      projects.set(property.project.id, {
        ...property.project,
        listingCount: (current?.listingCount ?? 0) + 1
      });
    }

    const items = [...projects.values()]
      .sort((left, right) => right.listingCount - left.listingCount || left.name.localeCompare(right.name))
      .slice(0, Math.min(Math.max(filters.limit ?? 8, 1), 20))
      .map((project) => ({
        id: project.id,
        name: project.name,
        market: project.market,
        status: project.status,
        developer: project.developer,
        address: project.address,
        listingCount: project.listingCount
      }));

    return { filters, items, total: items.length };
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

  private sortProperties(properties: PropertySnapshot[], filters: PropertySearchRequest): PropertySnapshot[] {
    return [...properties].sort((left, right) => {
      if (filters.sort === "price-asc") {
        return left.price.amount - right.price.amount;
      }

      if (filters.sort === "yield-desc") {
        return this.grossYield(right) - this.grossYield(left);
      }

      if (filters.sort === "beach-asc") {
        return this.beachDistance(left) - this.beachDistance(right);
      }

      if (filters.sort === "ai-fit") {
        return this.catalogFitScore(right) - this.catalogFitScore(left);
      }

      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
  }

  private grossYield(property: PropertySnapshot): number {
    if (!property.monthlyRentEstimate?.amount || !property.price.amount) {
      return 0;
    }

    return (property.monthlyRentEstimate.amount * 12) / property.price.amount;
  }

  private beachDistance(property: PropertySnapshot): number {
    return property.beachDistanceMeters ?? Number.MAX_SAFE_INTEGER;
  }

  private catalogFitScore(property: PropertySnapshot): number {
    let score = property.status === "available" ? 40 : 10;

    if (property.beachDistanceMeters !== undefined) {
      score += Math.max(0, 25 - property.beachDistanceMeters / 100);
    }

    if (property.amenities.some((amenity) => amenity.includes("fiber") || amenity.includes("coworking"))) {
      score += 12;
    }

    if (property.amenities.some((amenity) => amenity.includes("sea-view") || amenity.includes("beachfront"))) {
      score += 10;
    }

    score += Math.min(18, this.grossYield(property) * 200);

    return score;
  }
}

function normalizeProjectName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(?:the|condo|condominium|village|project|residence|residences)\b/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}
