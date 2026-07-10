import { Client } from "@opensearch-project/opensearch";
import type { Pool } from "pg";
import { PROPERTY_SEARCH_INDEX } from "@propertyflow/contracts";
import type {
  Currency,
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
    private readonly client: Client
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

    return document;
  }

  private async findProperty(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        select *
        from properties
        where tenant_id = $1 and id = $2
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
      ...property.amenities
    ]
      .filter(Boolean)
      .join(" "),
    createdAt: property.createdAt,
    updatedAt: property.updatedAt
  };
}
