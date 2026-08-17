import { Client } from "@opensearch-project/opensearch";
import { KnowledgeEmbeddingGenerator } from "@propertyflow/domain";
import type { Pool } from "pg";
import { PROPERTY_SEARCH_INDEX } from "@propertyflow/contracts";
import type {
  Currency,
  ListingLocationFeatures,
  PropertyKind,
  PropertyListingType,
  PropertySnapshot,
  PropertyStatus,
  ThailandMarket
} from "@propertyflow/domain";

interface PropertyRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  kind: PropertyKind;
  listing_type: PropertyListingType | null;
  market: ThailandMarket;
  status: PropertyStatus;
  price_amount: string;
  price_currency: Currency;
  rental_price_monthly_amount: string | null;
  rental_price_monthly_currency: Currency | null;
  latitude: number;
  longitude: number;
  address: string | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: string;
  floor: number | null;
  beach_distance_meters: number | null;
  nearest_beach_distance_meters: number | null;
  nearest_baht_bus_route_distance_meters: number | null;
  nearest_public_transport_distance_meters: number | null;
  nearest_taxi_stand_distance_meters: number | null;
  nearest_supermarket_distance_meters: number | null;
  nearest_mall_distance_meters: number | null;
  nearest_hospital_distance_meters: number | null;
  nearest_international_school_distance_meters: number | null;
  nearest_nightlife_distance_meters: number | null;
  nearest_airport_connection_distance_meters: number | null;
  walkability_score: number | null;
  location_features_updated_at: Date | null;
  monthly_rent_estimate_amount: string | null;
  monthly_rent_estimate_currency: Currency | null;
  maintenance_fee_monthly_amount: string | null;
  maintenance_fee_monthly_currency: Currency | null;
  amenities: string[];
  created_at: Date;
  updated_at: Date;
}

export interface PropertySearchDocument {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  kind: PropertyKind;
  listingType: PropertyListingType;
  market: ThailandMarket;
  status: PropertyStatus;
  priceAmount: number;
  priceCurrency: Currency;
  rentalPriceMonthlyAmount?: number;
  rentalPriceMonthlyCurrency?: Currency;
  location: {
    lat: number;
    lon: number;
  };
  address?: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  floor?: number;
  beachDistanceMeters?: number;
  locationFeatures?: ListingLocationFeatures;
  monthlyRentEstimateAmount?: number;
  maintenanceFeeMonthlyAmount?: number;
  amenities: string[];
  searchableText: string;
  createdAt: string;
  updatedAt: string;
}

export class PropertySearchIndexer {
  constructor(
    private readonly pool: Pool,
    private readonly client: Client,
    private readonly embeddings: KnowledgeEmbeddingGenerator
  ) {}

  async indexProperty(tenantId: string, propertyId: string): Promise<PropertySearchDocument> {
    const property = await this.findProperty(tenantId, propertyId);

    if (!property) {
      throw new Error(`Property ${propertyId} was not found for tenant ${tenantId}`);
    }

    const document = toSearchDocument(property);

    await this.ensureIndex();
    await this.client.index({
      index: PROPERTY_SEARCH_INDEX,
      id: `${tenantId}:${propertyId}`,
      body: document,
      refresh: true
    });
    await this.upsertPropertyEmbedding(document).catch((error: unknown) => {
      console.warn(
        `[property-search] pgvector embedding unavailable for ${tenantId}:${propertyId}`,
        error instanceof Error ? error.message : error
      );
    });

    return document;
  }

  private async upsertPropertyEmbedding(document: PropertySearchDocument): Promise<void> {
    const now = new Date().toISOString();
    const searchText = buildPropertyEmbeddingText(document);

    try {
      const embedding = await this.embeddings.embed(searchText, "document");

      await this.pool.query(
        `
          insert into property_search_embeddings (
            tenant_id,
            property_id,
            search_text,
            embedding,
            embedding_model,
            embedding_status,
            last_error,
            created_at,
            updated_at
          ) values (
            $1,
            $2,
            $3,
            $4::vector,
            $5,
            'embedded',
            null,
            $6,
            $6
          )
          on conflict (tenant_id, property_id) do update
          set
            search_text = excluded.search_text,
            embedding = excluded.embedding,
            embedding_model = excluded.embedding_model,
            embedding_status = 'embedded',
            last_error = null,
            updated_at = excluded.updated_at
        `,
        [document.tenantId, document.id, searchText, toVectorLiteral(embedding.vector), embedding.modelKey, now]
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Property embedding failed";

      await this.pool.query(
        `
          insert into property_search_embeddings (
            tenant_id,
            property_id,
            search_text,
            embedding,
            embedding_model,
            embedding_status,
            last_error,
            created_at,
            updated_at
          ) values (
            $1,
            $2,
            $3,
            null,
            $4,
            'failed',
            $5,
            $6,
            $6
          )
          on conflict (tenant_id, property_id) do update
          set
            search_text = excluded.search_text,
            embedding_status = 'failed',
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        `,
        [document.tenantId, document.id, searchText, this.embeddings.modelKey(), reason, now]
      );
    }
  }

  private async findProperty(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        select
          p.*,
          lf.nearest_beach_distance_meters,
          lf.nearest_baht_bus_route_distance_meters,
          lf.nearest_public_transport_distance_meters,
          lf.nearest_taxi_stand_distance_meters,
          lf.nearest_supermarket_distance_meters,
          lf.nearest_mall_distance_meters,
          lf.nearest_hospital_distance_meters,
          lf.nearest_international_school_distance_meters,
          lf.nearest_nightlife_distance_meters,
          lf.nearest_airport_connection_distance_meters,
          lf.walkability_score,
          lf.updated_at as location_features_updated_at
        from properties p
        left join listing_location_features lf
          on lf.tenant_id = p.tenant_id and lf.listing_id = p.id
        where p.tenant_id = $1 and p.id = $2
        limit 1
      `,
      [tenantId, propertyId]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description ?? undefined,
      kind: row.kind,
      listingType: row.listing_type ?? "sale",
      market: row.market,
      status: row.status,
      price: {
        amount: Number(row.price_amount),
        currency: row.price_currency
      },
      rentalPriceMonthly:
        row.rental_price_monthly_amount && row.rental_price_monthly_currency
          ? {
              amount: Number(row.rental_price_monthly_amount),
              currency: row.rental_price_monthly_currency
            }
          : undefined,
      location: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude)
      },
      address: row.address ?? undefined,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      areaSqm: Number(row.area_sqm),
      floor: row.floor ?? undefined,
      beachDistanceMeters: row.beach_distance_meters ?? undefined,
      locationFeatures: toLocationFeatures(row),
      monthlyRentEstimate:
        row.monthly_rent_estimate_amount && row.monthly_rent_estimate_currency
          ? {
              amount: Number(row.monthly_rent_estimate_amount),
              currency: row.monthly_rent_estimate_currency
            }
          : undefined,
      maintenanceFeeMonthly:
        row.maintenance_fee_monthly_amount && row.maintenance_fee_monthly_currency
          ? {
              amount: Number(row.maintenance_fee_monthly_amount),
              currency: row.maintenance_fee_monthly_currency
            }
          : undefined,
      amenities: row.amenities,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: PROPERTY_SEARCH_INDEX
    });

    if (exists.body === true) {
      return;
    }

    await this.client.indices.create({
      index: PROPERTY_SEARCH_INDEX,
      body: {
        settings: {
          index: {
            number_of_shards: 1,
            number_of_replicas: 0
          }
        },
        mappings: {
          properties: {
            id: { type: "keyword" },
            tenantId: { type: "keyword" },
            title: { type: "text" },
            description: { type: "text" },
            kind: { type: "keyword" },
            listingType: { type: "keyword" },
            market: { type: "keyword" },
            status: { type: "keyword" },
            priceAmount: { type: "double" },
            priceCurrency: { type: "keyword" },
            rentalPriceMonthlyAmount: { type: "double" },
            rentalPriceMonthlyCurrency: { type: "keyword" },
            location: { type: "geo_point" },
            address: { type: "text" },
            bedrooms: { type: "integer" },
            bathrooms: { type: "integer" },
            areaSqm: { type: "double" },
            floor: { type: "integer" },
            beachDistanceMeters: { type: "integer" },
            locationFeatures: {
              properties: {
                nearestBeachDistanceMeters: { type: "integer" },
                nearestBahtBusRouteDistanceMeters: { type: "integer" },
                nearestPublicTransportDistanceMeters: { type: "integer" },
                nearestTaxiStandDistanceMeters: { type: "integer" },
                nearestSupermarketDistanceMeters: { type: "integer" },
                nearestMallDistanceMeters: { type: "integer" },
                nearestHospitalDistanceMeters: { type: "integer" },
                nearestInternationalSchoolDistanceMeters: { type: "integer" },
                nearestNightlifeDistanceMeters: { type: "integer" },
                nearestAirportConnectionDistanceMeters: { type: "integer" },
                walkabilityScore: { type: "integer" },
                updatedAt: { type: "date" }
              }
            },
            monthlyRentEstimateAmount: { type: "double" },
            maintenanceFeeMonthlyAmount: { type: "double" },
            amenities: { type: "keyword" },
            searchableText: { type: "text" },
            createdAt: { type: "date" },
            updatedAt: { type: "date" }
          }
        }
      }
    });
  }
}

function toSearchDocument(property: PropertySnapshot): PropertySearchDocument {
  return {
    id: property.id,
    tenantId: property.tenantId,
    title: property.title,
    description: property.description,
    kind: property.kind,
    listingType: property.listingType,
    market: property.market,
    status: property.status,
    priceAmount: property.price.amount,
    priceCurrency: property.price.currency,
    rentalPriceMonthlyAmount: property.rentalPriceMonthly?.amount,
    rentalPriceMonthlyCurrency: property.rentalPriceMonthly?.currency,
    location: {
      lat: property.location.latitude,
      lon: property.location.longitude
    },
    address: property.address,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqm: property.areaSqm,
    floor: property.floor,
    beachDistanceMeters: property.beachDistanceMeters,
    locationFeatures: property.locationFeatures,
    monthlyRentEstimateAmount: property.monthlyRentEstimate?.amount,
    maintenanceFeeMonthlyAmount: property.maintenanceFeeMonthly?.amount,
    amenities: property.amenities,
    searchableText: [
      property.title,
      property.description,
      property.address,
      property.market,
      property.kind,
      property.listingType,
      property.locationFeatures?.nearestSupermarketDistanceMeters !== undefined
        ? `${property.locationFeatures.nearestSupermarketDistanceMeters}m from supermarket`
        : undefined,
      property.locationFeatures?.nearestBahtBusRouteDistanceMeters !== undefined
        ? `${property.locationFeatures.nearestBahtBusRouteDistanceMeters}m from baht bus route`
        : undefined,
      property.locationFeatures?.nearestPublicTransportDistanceMeters !== undefined
        ? `${property.locationFeatures.nearestPublicTransportDistanceMeters}m from public transport`
        : undefined,
      property.locationFeatures?.walkabilityScore !== undefined ? `walkability score ${property.locationFeatures.walkabilityScore}` : undefined,
      ...property.amenities
    ]
      .filter(Boolean)
      .join(" "),
    createdAt: property.createdAt,
    updatedAt: property.updatedAt
  };
}

function buildPropertyEmbeddingText(document: PropertySearchDocument): string {
  return [
    document.title,
    document.description,
    document.address,
    document.market,
    document.kind,
    document.listingType,
    document.status,
    `${document.bedrooms} bedrooms`,
    `${document.bathrooms} bathrooms`,
    `${document.areaSqm} sqm`,
    document.beachDistanceMeters !== undefined ? `${document.beachDistanceMeters}m from beach` : undefined,
    document.locationFeatures?.nearestSupermarketDistanceMeters !== undefined
      ? `${document.locationFeatures.nearestSupermarketDistanceMeters}m from supermarket`
      : undefined,
    document.locationFeatures?.nearestBahtBusRouteDistanceMeters !== undefined
      ? `${document.locationFeatures.nearestBahtBusRouteDistanceMeters}m from baht bus route`
      : undefined,
    document.locationFeatures?.nearestPublicTransportDistanceMeters !== undefined
      ? `${document.locationFeatures.nearestPublicTransportDistanceMeters}m from public transport`
      : undefined,
    document.locationFeatures?.walkabilityScore !== undefined ? `walkability score ${document.locationFeatures.walkabilityScore}` : undefined,
    document.priceAmount ? `${document.priceAmount} ${document.priceCurrency}` : undefined,
    document.rentalPriceMonthlyAmount ? `${document.rentalPriceMonthlyAmount} monthly rent` : undefined,
    ...document.amenities
  ]
    .filter(Boolean)
    .join(" ");
}

function toLocationFeatures(row: PropertyRow): ListingLocationFeatures | undefined {
  if (!row.location_features_updated_at) {
    return undefined;
  }

  return {
    nearestBeachDistanceMeters: row.nearest_beach_distance_meters ?? undefined,
    nearestBahtBusRouteDistanceMeters: row.nearest_baht_bus_route_distance_meters ?? undefined,
    nearestPublicTransportDistanceMeters: row.nearest_public_transport_distance_meters ?? undefined,
    nearestTaxiStandDistanceMeters: row.nearest_taxi_stand_distance_meters ?? undefined,
    nearestSupermarketDistanceMeters: row.nearest_supermarket_distance_meters ?? undefined,
    nearestMallDistanceMeters: row.nearest_mall_distance_meters ?? undefined,
    nearestHospitalDistanceMeters: row.nearest_hospital_distance_meters ?? undefined,
    nearestInternationalSchoolDistanceMeters: row.nearest_international_school_distance_meters ?? undefined,
    nearestNightlifeDistanceMeters: row.nearest_nightlife_distance_meters ?? undefined,
    nearestAirportConnectionDistanceMeters: row.nearest_airport_connection_distance_meters ?? undefined,
    walkabilityScore: row.walkability_score ?? undefined,
    updatedAt: row.location_features_updated_at.toISOString()
  };
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
