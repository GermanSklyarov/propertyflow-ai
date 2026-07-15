import { Injectable } from "@nestjs/common";
import type {
  CreatePropertyProjectRequest,
  PropertyPriceHistoryPoint,
  PropertyProjectSearchRequest,
  PropertyProjectSearchResponse,
  PropertyProjectSuggestion,
  PropertySearchResponse,
  PropertySearchRequest,
  UpdatePropertyProjectRequest
} from "@propertyflow/contracts";
import type { Money, PropertySnapshot, PropertyStatus } from "@propertyflow/domain";
import type { PropertyRepository } from "../domain/property.repository.js";

@Injectable()
export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly properties = new Map<string, PropertySnapshot>();
  private readonly projects = new Map<string, NonNullable<PropertySnapshot["project"]>>();
  private readonly priceHistory = new Map<string, PropertyPriceHistoryPoint[]>();

  async save(property: PropertySnapshot): Promise<PropertySnapshot> {
    this.properties.set(this.key(property.tenantId, property.id), property);

    if (property.project) {
      this.projects.set(this.key(property.tenantId, property.project.id), property.project);
    }

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

    if (updated.project) {
      this.projects.set(this.key(tenantId, updated.project.id), updated.project);
    }

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
    return (await this.searchPage(tenantId, filters)).items;
  }

  async searchPage(tenantId: string, filters: PropertySearchRequest): Promise<PropertySearchResponse> {
    const properties = await this.list(tenantId);

    const facetProperties = properties.filter((property) => {
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

      if (filters.query && !this.matchesSmartQuery(property, filters.query)) {
        return false;
      }

      return true;
    });
    const filteredProperties = facetProperties.filter((property) => {
      if (filters.projectLink === "linked" && !property.project) {
        return false;
      }

      if (filters.projectLink === "missing" && property.project) {
        return false;
      }

      return true;
    });

    const sortedProperties = this.sortProperties(filteredProperties, filters);
    const offset = filters.offset ?? 0;
    const items =
      filters.limit !== undefined
        ? sortedProperties.slice(offset, offset + filters.limit)
        : sortedProperties.slice(offset);

    return {
      facets: {
        projectLink: {
          all: facetProperties.length,
          linked: facetProperties.filter((property) => property.project).length,
          missing: facetProperties.filter((property) => !property.project).length
        }
      },
      filters,
      items,
      total: filteredProperties.length
    };
  }

  async searchProjects(tenantId: string, filters: PropertyProjectSearchRequest): Promise<PropertyProjectSearchResponse> {
    const query = filters.query ? normalizeProjectName(filters.query) : "";
    const projects = new Map<
      string,
      NonNullable<PropertySnapshot["project"]> & { listingCount: number; rentCount: number; saleCount: number }
    >();

    for (const project of this.projects.values()) {
      if (project.tenantId !== tenantId || (filters.market && project.market !== filters.market)) {
        continue;
      }

      const normalized = normalizeProjectName(project.name);

      if (query && !normalized.includes(query)) {
        continue;
      }

      projects.set(project.id, {
        ...project,
        listingCount: 0,
        rentCount: 0,
        saleCount: 0
      });
    }

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
        listingCount: (current?.listingCount ?? 0) + 1,
        rentCount: (current?.rentCount ?? 0) + (property.listingType === "rent" || property.listingType === "sale_or_rent" ? 1 : 0),
        saleCount: (current?.saleCount ?? 0) + (property.listingType === "sale" || property.listingType === "sale_or_rent" ? 1 : 0)
      });
    }

    const sortedProjects = [...projects.values()].sort(
      (left, right) => right.listingCount - left.listingCount || left.name.localeCompare(right.name)
    );
    const statusCounts = new Map<NonNullable<PropertySnapshot["project"]>["status"], number>();

    for (const project of sortedProjects) {
      statusCounts.set(project.status, (statusCounts.get(project.status) ?? 0) + 1);
    }

    const offset = Math.max(filters.offset ?? 0, 0);
    const limit = Math.min(Math.max(filters.limit ?? 8, 1), 100);
    const items = sortedProjects
      .slice(offset, offset + limit)
      .map((project) => ({
        id: project.id,
        name: project.name,
        market: project.market,
        status: project.status,
        developer: project.developer,
        address: project.address,
        listingCount: project.listingCount,
        rentCount: project.rentCount,
        saleCount: project.saleCount
      }));

    return {
      facets: {
        status: [...statusCounts.entries()]
          .map(([label, count]) => ({ count, label }))
          .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      },
      filters,
      items,
      total: sortedProjects.length
    };
  }

  async createProject(tenantId: string, project: CreatePropertyProjectRequest): Promise<PropertyProjectSuggestion> {
    const normalized = normalizeProjectName(project.name);
    const existing = [...this.projects.values()].find(
      (item) => item.tenantId === tenantId && item.market === project.market && normalizeProjectName(item.name) === normalized
    );
    const now = new Date().toISOString();
    const snapshot = {
      amenities: project.amenities ?? existing?.amenities ?? [],
      createdAt: existing?.createdAt ?? now,
      id: existing?.id ?? crypto.randomUUID(),
      tenantId,
      name: project.name,
      market: project.market,
      status: project.status ?? existing?.status ?? "completed",
      developer: project.developer ?? existing?.developer,
      address: project.address ?? existing?.address,
      completionYear: project.completionYear ?? existing?.completionYear,
      updatedAt: now
    } satisfies NonNullable<PropertySnapshot["project"]>;

    this.projects.set(this.key(tenantId, snapshot.id), snapshot);

    const result = await this.searchProjects(tenantId, { limit: 1, market: project.market, query: project.name });

    return (
      result.items.find((item) => item.id === snapshot.id) ?? {
        id: snapshot.id,
        listingCount: 0,
        market: snapshot.market,
        name: snapshot.name,
        rentCount: 0,
        saleCount: 0,
        status: snapshot.status
      }
    );
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

      if (filters.sort === "price-desc") {
        return right.price.amount - left.price.amount;
      }

      if (filters.sort === "rent-asc") {
        return this.rent(left) - this.rent(right);
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
    const rent = property.rentalPriceMonthly ?? property.monthlyRentEstimate;

    if (!rent?.amount || !property.price.amount) {
      return 0;
    }

    return (rent.amount * 12) / property.price.amount;
  }

  private rent(property: PropertySnapshot): number {
    return property.rentalPriceMonthly?.amount ?? property.monthlyRentEstimate?.amount ?? Number.MAX_SAFE_INTEGER;
  }

  private matchesSmartQuery(property: PropertySnapshot, query: string): boolean {
    const parsed = parseInventoryQuery(query);

    if (parsed.bedrooms !== undefined && property.bedrooms !== parsed.bedrooms) {
      return false;
    }

    if (parsed.maxRentMonthly !== undefined && this.rent(property) > parsed.maxRentMonthly) {
      return false;
    }

    if (parsed.maxPrice !== undefined && property.price.amount > parsed.maxPrice) {
      return false;
    }

    if (parsed.requiresMissingProject && property.project) {
      return false;
    }

    const haystack = [
      property.title,
      property.description,
      property.kind,
      property.listingType,
      property.market,
      property.status,
      property.address,
      property.project?.name,
      property.project?.developer,
      ...property.amenities
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return parsed.tokens.every((token) => haystack.includes(token));
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

function parseInventoryQuery(query?: string) {
  const raw = query?.trim().toLowerCase() ?? "";
  const bedroomMatch = raw.match(/\b(\d+)\s*(?:bed|beds|bedroom|bedrooms|bd)\b/);
  const maxRentMatch = raw.match(
    /\b(?:under|below|max|up to)\s*(\d+(?:\.\d+)?)\s*(k)?\s*(?:\/?\s*month|monthly|rent|thb\/mo|k\/mo)\b/
  );
  const maxPriceMatch =
    raw.match(/\b(?:under|below|max|up to)\s*(\d+(?:\.\d+)?)\s*(m|million|mln)\b/) ??
    raw.match(/\b(?:under|below|max|up to)\s*(\d+(?:\.\d+)?)\s*(?:thb|baht|sale|price)\b/);
  const ignoredTokens = new Set([
    "a",
    "an",
    "and",
    "baht",
    "below",
    "for",
    "max",
    "month",
    "monthly",
    "price",
    "rent",
    "sale",
    "thb",
    "under",
    "up",
    "to",
    "with"
  ]);
  const tokens = raw
    .replace(/\b\d+(?:\.\d+)?\s*(?:k|m|million|mln)?\b/g, " ")
    .replace(/\b(?:bed|beds|bedroom|bedrooms|bd|month|monthly|thb\/mo|k\/mo)\b/g, " ")
    .split(/[^a-z0-9-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !ignoredTokens.has(token));

  return {
    bedrooms: bedroomMatch ? Number(bedroomMatch[1]) : undefined,
    maxPrice: maxPriceMatch ? parseMoneyAmount(maxPriceMatch[1], maxPriceMatch[2]) : undefined,
    maxRentMonthly: maxRentMatch ? parseMoneyAmount(maxRentMatch[1], maxRentMatch[2]) : undefined,
    raw,
    requiresMissingProject: /\b(?:missing project|no project|without project|unlinked)\b/.test(raw),
    tokens
  };
}

function parseMoneyAmount(value: string, suffix?: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return undefined;
  }

  if (suffix === "m" || suffix === "million" || suffix === "mln") {
    return amount * 1_000_000;
  }

  if (suffix === "k") {
    return amount * 1_000;
  }

  return amount;
}
