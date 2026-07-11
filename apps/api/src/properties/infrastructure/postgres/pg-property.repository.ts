import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { PropertyPriceHistoryPoint, PropertySearchRequest } from "@propertyflow/contracts";
import type {
  Currency,
  Money,
  PropertyKind,
  PropertyListingType,
  PropertySnapshot,
  PropertyStatus,
  ThailandMarket
} from "@propertyflow/domain";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertyRepository } from "../../domain/property.repository.js";

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

interface PropertyPriceHistoryRow {
  price_amount: string;
  price_currency: Currency;
  source: PropertyPriceHistoryPoint["source"];
  effective_date: Date;
}

@Injectable()
export class PgPropertyRepository implements PropertyRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async save(property: PropertySnapshot): Promise<PropertySnapshot> {
    const result = await this.pool.query<PropertyRow>(
      `
        insert into properties (
          id,
          tenant_id,
          title,
          description,
          kind,
          listing_type,
          market,
          status,
          price_amount,
          price_currency,
          rental_price_monthly_amount,
          rental_price_monthly_currency,
          location,
          latitude,
          longitude,
          address,
          bedrooms,
          bathrooms,
          area_sqm,
          floor,
          beach_distance_meters,
          monthly_rent_estimate_amount,
          monthly_rent_estimate_currency,
          maintenance_fee_monthly_amount,
          maintenance_fee_monthly_currency,
          amenities,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          st_setsrid(st_makepoint($13, $14), 4326)::geography,
          $14,
          $13,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22,
          $23,
          $24,
          $25,
          $26,
          $27,
          $28
        )
        returning *
      `,
      [
        property.id,
        property.tenantId,
        property.title,
        property.description ?? null,
        property.kind,
        property.listingType,
        property.market,
        property.status,
        property.price.amount,
        property.price.currency,
        property.rentalPriceMonthly?.amount ?? null,
        property.rentalPriceMonthly?.currency ?? null,
        property.location.longitude,
        property.location.latitude,
        property.address ?? null,
        property.bedrooms,
        property.bathrooms,
        property.areaSqm,
        property.floor ?? null,
        property.beachDistanceMeters ?? null,
        property.monthlyRentEstimate?.amount ?? null,
        property.monthlyRentEstimate?.currency ?? null,
        property.maintenanceFeeMonthly?.amount ?? null,
        property.maintenanceFeeMonthly?.currency ?? null,
        property.amenities,
        property.createdAt,
        property.updatedAt
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        select *
        from properties
        where tenant_id = $1 and id = $2
        limit 1
      `,
      [tenantId, propertyId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateListingText(
    tenantId: string,
    propertyId: string,
    title: string,
    description: string
  ): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        update properties
        set title = $3,
            description = $4,
            updated_at = $5
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, propertyId, title, description, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateAmenities(tenantId: string, propertyId: string, amenities: string[]): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        update properties
        set amenities = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, propertyId, amenities, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updatePrice(tenantId: string, propertyId: string, price: Money): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        update properties
        set price_amount = $3,
            price_currency = $4,
            updated_at = $5
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, propertyId, price.amount, price.currency, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateStatus(
    tenantId: string,
    propertyId: string,
    status: PropertyStatus
  ): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        update properties
        set status = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, propertyId, status, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async list(tenantId: string): Promise<PropertySnapshot[]> {
    return this.search(tenantId, {});
  }

  async search(tenantId: string, filters: PropertySearchRequest): Promise<PropertySnapshot[]> {
    const clauses = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];

    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.market) {
      clauses.push(`market = ${addValue(filters.market)}`);
    }

    if (filters.listingType) {
      clauses.push(`listing_type in (${addValue(filters.listingType)}, 'sale_or_rent')`);
    }

    if (filters.minPriceThb !== undefined) {
      clauses.push(`price_currency = 'THB' and price_amount >= ${addValue(filters.minPriceThb)}`);
    }

    if (filters.maxPriceThb !== undefined) {
      clauses.push(`price_currency = 'THB' and price_amount <= ${addValue(filters.maxPriceThb)}`);
    }

    if (filters.minMonthlyRentThb !== undefined) {
      clauses.push(
        `rental_price_monthly_currency = 'THB' and rental_price_monthly_amount >= ${addValue(filters.minMonthlyRentThb)}`
      );
    }

    if (filters.maxMonthlyRentThb !== undefined) {
      clauses.push(
        `rental_price_monthly_currency = 'THB' and rental_price_monthly_amount <= ${addValue(filters.maxMonthlyRentThb)}`
      );
    }

    if (filters.minBedrooms !== undefined) {
      clauses.push(`bedrooms >= ${addValue(filters.minBedrooms)}`);
    }

    if (filters.minBathrooms !== undefined) {
      clauses.push(`bathrooms >= ${addValue(filters.minBathrooms)}`);
    }

    if (filters.minAreaSqm !== undefined) {
      clauses.push(`area_sqm >= ${addValue(filters.minAreaSqm)}`);
    }

    if (filters.maxBeachDistanceMeters !== undefined) {
      clauses.push(`beach_distance_meters <= ${addValue(filters.maxBeachDistanceMeters)}`);
    }

    if (filters.requiredAmenities?.length) {
      clauses.push(`amenities @> ${addValue(filters.requiredAmenities)}::text[]`);
    }

    if (filters.near && filters.radiusMeters !== undefined) {
      const longitude = addValue(filters.near.longitude);
      const latitude = addValue(filters.near.latitude);
      const radius = addValue(filters.radiusMeters);
      clauses.push(`st_dwithin(location, st_setsrid(st_makepoint(${longitude}, ${latitude}), 4326)::geography, ${radius})`);
    }

    const paginationClauses: string[] = [];

    if (filters.limit !== undefined) {
      paginationClauses.push(`limit ${addValue(filters.limit)}`);
    }

    if (filters.offset !== undefined) {
      paginationClauses.push(`offset ${addValue(filters.offset)}`);
    }

    const result = await this.pool.query<PropertyRow>(
      `
        select *
        from properties
        where ${clauses.join(" and ")}
        order by ${this.orderBy(filters)}
        ${paginationClauses.join(" ")}
      `,
      values
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  private orderBy(filters: PropertySearchRequest): string {
    if (filters.sort === "price-asc") {
      return "price_amount asc, created_at desc";
    }

    if (filters.sort === "yield-desc") {
      return `
        case
          when monthly_rent_estimate_amount is not null and price_amount > 0
            then monthly_rent_estimate_amount * 12 / price_amount
          else 0
        end desc,
        created_at desc
      `;
    }

    if (filters.sort === "beach-asc") {
      return "beach_distance_meters asc nulls last, created_at desc";
    }

    if (filters.sort === "ai-fit") {
      return `
        (
          case when status = 'available' then 40 else 10 end
          + case
              when beach_distance_meters is not null then greatest(0, 25 - beach_distance_meters::numeric / 100)
              else 0
            end
          + case when amenities && array['fiber-internet', 'coworking-lounge']::text[] then 12 else 0 end
          + case when amenities && array['sea-view', 'beachfront']::text[] then 10 else 0 end
          + least(
              18,
              case
                when monthly_rent_estimate_amount is not null and price_amount > 0
                  then monthly_rent_estimate_amount * 12 / price_amount * 200
                else 0
              end
            )
        ) desc,
        created_at desc
      `;
    }

    return "created_at desc";
  }

  async addPriceHistoryPoint(
    tenantId: string,
    propertyId: string,
    price: Money,
    source: PropertyPriceHistoryPoint["source"],
    effectiveDate: string
  ): Promise<PropertyPriceHistoryPoint> {
    const result = await this.pool.query<PropertyPriceHistoryRow>(
      `
        insert into property_price_history (
          id,
          tenant_id,
          property_id,
          price_amount,
          price_currency,
          source,
          effective_date
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        returning price_amount, price_currency, source, effective_date
      `,
      [crypto.randomUUID(), tenantId, propertyId, price.amount, price.currency, source, effectiveDate]
    );

    return this.toPriceHistoryPoint(result.rows[0]);
  }

  async listPriceHistory(tenantId: string, propertyId: string): Promise<PropertyPriceHistoryPoint[]> {
    const result = await this.pool.query<PropertyPriceHistoryRow>(
      `
        select price_amount, price_currency, source, effective_date
        from property_price_history
        where tenant_id = $1 and property_id = $2
        order by effective_date asc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toPriceHistoryPoint(row));
  }

  private toSnapshot(row: PropertyRow): PropertySnapshot {
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
      rentalPriceMonthly: this.optionalMoney(row.rental_price_monthly_amount, row.rental_price_monthly_currency),
      location: {
        latitude: row.latitude,
        longitude: row.longitude
      },
      address: row.address ?? undefined,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      areaSqm: Number(row.area_sqm),
      floor: row.floor ?? undefined,
      beachDistanceMeters: row.beach_distance_meters ?? undefined,
      monthlyRentEstimate: this.optionalMoney(row.monthly_rent_estimate_amount, row.monthly_rent_estimate_currency),
      maintenanceFeeMonthly: this.optionalMoney(row.maintenance_fee_monthly_amount, row.maintenance_fee_monthly_currency),
      amenities: row.amenities,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private optionalMoney(amount: string | null, currency: Currency | null): Money | undefined {
    if (!amount || !currency) {
      return undefined;
    }

    return {
      amount: Number(amount),
      currency
    };
  }

  private toPriceHistoryPoint(row: PropertyPriceHistoryRow): PropertyPriceHistoryPoint {
    return {
      effectiveDate: row.effective_date.toISOString(),
      price: {
        amount: Number(row.price_amount),
        currency: row.price_currency
      },
      source: row.source
    };
  }
}
