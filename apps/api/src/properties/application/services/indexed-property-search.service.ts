import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import {
  type IndexedPropertySearchHit,
  type IndexedPropertySearchRequest,
  type IndexedPropertySearchResponse,
  PROPERTY_SEARCH_INDEX
} from "@propertyflow/contracts";
import type { Currency, PropertyKind, PropertyStatus, ThailandMarket } from "@propertyflow/domain";
import { PROPERTY_SEARCH_CLIENT } from "../../infrastructure/opensearch/property-search-client.js";

interface PropertySearchDocument {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  kind: PropertyKind;
  market: ThailandMarket;
  status: PropertyStatus;
  priceAmount: number;
  priceCurrency: Currency;
  location: {
    lat: number;
    lon: number;
  };
  address?: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  beachDistanceMeters?: number;
  amenities: string[];
}

interface OpenSearchHit {
  _score?: number;
  _source: PropertySearchDocument;
  highlight?: Record<string, string[]>;
}

interface OpenSearchSearchBody {
  took?: number;
  hits: {
    total?: number | { value: number };
    hits: OpenSearchHit[];
  };
}

@Injectable()
export class IndexedPropertySearchService {
  constructor(@Inject(PROPERTY_SEARCH_CLIENT) private readonly client: Client) {}

  async search(tenantId: string, request: IndexedPropertySearchRequest): Promise<IndexedPropertySearchResponse> {
    try {
      const response = await this.client.search({
        index: PROPERTY_SEARCH_INDEX,
        from: request.offset ?? 0,
        size: request.limit ?? 20,
        body: {
          query: {
            bool: {
              must: this.buildMustClauses(request),
              filter: this.buildFilterClauses(tenantId, request)
            }
          },
          sort: this.buildSort(request),
          highlight: {
            fields: {
              title: {},
              description: {},
              address: {},
              searchableText: {}
            },
            number_of_fragments: 2,
            fragment_size: 140
          }
        }
      });

      const body = response.body as unknown as OpenSearchSearchBody;

      return {
        items: body.hits.hits.map((hit) => toSearchHit(hit)),
        total: readTotal(body.hits.total),
        filters: request,
        index: PROPERTY_SEARCH_INDEX,
        tookMs: body.took
      };
    } catch (error) {
      if (isMissingIndexError(error)) {
        return {
          items: [],
          total: 0,
          filters: request,
          index: PROPERTY_SEARCH_INDEX
        };
      }

      throw error;
    }
  }

  private buildMustClauses(request: IndexedPropertySearchRequest): Record<string, unknown>[] {
    if (!request.query) {
      return [{ match_all: {} }];
    }

    return [
      {
        multi_match: {
          query: request.query,
          fields: ["title^4", "address^2", "description^2", "searchableText"],
          fuzziness: "AUTO"
        }
      }
    ];
  }

  private buildFilterClauses(tenantId: string, request: IndexedPropertySearchRequest): Record<string, unknown>[] {
    const filters: Record<string, unknown>[] = [{ term: { tenantId } }];

    if (request.market) {
      filters.push({ term: { market: request.market } });
    }

    if (request.minPriceThb !== undefined || request.maxPriceThb !== undefined) {
      filters.push({ term: { priceCurrency: "THB" } });
      filters.push({
        range: {
          priceAmount: {
            gte: request.minPriceThb,
            lte: request.maxPriceThb
          }
        }
      });
    }

    if (request.minBedrooms !== undefined) {
      filters.push({ range: { bedrooms: { gte: request.minBedrooms } } });
    }

    if (request.minBathrooms !== undefined) {
      filters.push({ range: { bathrooms: { gte: request.minBathrooms } } });
    }

    if (request.minAreaSqm !== undefined) {
      filters.push({ range: { areaSqm: { gte: request.minAreaSqm } } });
    }

    if (request.maxBeachDistanceMeters !== undefined) {
      filters.push({ range: { beachDistanceMeters: { lte: request.maxBeachDistanceMeters } } });
    }

    for (const amenity of request.requiredAmenities ?? []) {
      filters.push({ term: { amenities: amenity } });
    }

    if (request.near && request.radiusMeters !== undefined) {
      filters.push({
        geo_distance: {
          distance: `${request.radiusMeters}m`,
          location: {
            lat: request.near.latitude,
            lon: request.near.longitude
          }
        }
      });
    }

    return filters;
  }

  private buildSort(request: IndexedPropertySearchRequest): Array<Record<string, unknown>> {
    if (request.query) {
      return [{ _score: "desc" }, { createdAt: "desc" }];
    }

    return [{ createdAt: "desc" }];
  }
}

function toSearchHit(hit: OpenSearchHit): IndexedPropertySearchHit {
  const source = hit._source;

  return {
    propertyId: source.id,
    score: hit._score,
    title: source.title,
    description: source.description,
    market: source.market,
    kind: source.kind,
    status: source.status,
    price: {
      amount: source.priceAmount,
      currency: source.priceCurrency
    },
    location: {
      latitude: source.location.lat,
      longitude: source.location.lon
    },
    address: source.address,
    bedrooms: source.bedrooms,
    bathrooms: source.bathrooms,
    areaSqm: source.areaSqm,
    beachDistanceMeters: source.beachDistanceMeters,
    amenities: source.amenities,
    highlights: Object.values(hit.highlight ?? {}).flat()
  };
}

function readTotal(total: OpenSearchSearchBody["hits"]["total"]): number {
  if (typeof total === "number") {
    return total;
  }

  return total?.value ?? 0;
}

function isMissingIndexError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "meta" in error &&
    typeof (error as { meta?: { statusCode?: number } }).meta === "object" &&
    (error as { meta?: { statusCode?: number } }).meta?.statusCode === 404
  );
}
