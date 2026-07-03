import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { Currency, Money, PropertyKind, PropertySnapshot, PropertyStatus, ThailandMarket } from "@propertyflow/domain";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertyRepository } from "../../domain/property.repository.js";

interface PropertyRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  kind: PropertyKind;
  market: ThailandMarket;
  status: PropertyStatus;
  price_amount: string;
  price_currency: Currency;
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
          market,
          status,
          price_amount,
          price_currency,
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
          st_setsrid(st_makepoint($10, $11), 4326)::geography,
          $11,
          $10,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22,
          $23,
          $24
        )
        returning *
      `,
      [
        property.id,
        property.tenantId,
        property.title,
        property.description ?? null,
        property.kind,
        property.market,
        property.status,
        property.price.amount,
        property.price.currency,
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

  async list(tenantId: string): Promise<PropertySnapshot[]> {
    const result = await this.pool.query<PropertyRow>(
      `
        select *
        from properties
        where tenant_id = $1
        order by created_at desc
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  private toSnapshot(row: PropertyRow): PropertySnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description ?? undefined,
      kind: row.kind,
      market: row.market,
      status: row.status,
      price: {
        amount: Number(row.price_amount),
        currency: row.price_currency
      },
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
}

