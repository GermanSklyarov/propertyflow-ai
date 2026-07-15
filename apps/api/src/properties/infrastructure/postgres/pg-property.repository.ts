import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
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
import type {
  Currency,
  Money,
  PropertyKind,
  PropertyListingType,
  PropertyProjectStatus,
  PropertySnapshot,
  PropertyStatus,
  ThailandMarket
} from "@propertyflow/domain";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertyRepository } from "../../domain/property.repository.js";

interface PropertyRow {
  id: string;
  tenant_id: string;
  project_id: string | null;
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
  cover_image_id: string | null;
  cover_image_url: string | null;
  cover_object_key: string | null;
  created_at: Date;
  updated_at: Date;
  project_name: string | null;
  project_market: ThailandMarket | null;
  project_status: PropertyProjectStatus | null;
  project_developer: string | null;
  project_address: string | null;
  project_completion_year: number | null;
  project_latitude: number | null;
  project_longitude: number | null;
  project_amenities: string[] | null;
  project_created_at: Date | null;
  project_updated_at: Date | null;
}

interface PropertyPriceHistoryRow {
  price_amount: string;
  price_currency: Currency;
  source: PropertyPriceHistoryPoint["source"];
  effective_date: Date;
}

interface PropertyProjectSuggestionRow {
  id: string;
  name: string;
  market: ThailandMarket;
  status: PropertyProjectStatus;
  developer: string | null;
  address: string | null;
  listing_count: string;
  rent_count: string;
  sale_count: string;
}

interface PropertyProjectContextRow {
  market: ThailandMarket;
  latitude: number;
  longitude: number;
}

@Injectable()
export class PgPropertyRepository implements PropertyRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async save(property: PropertySnapshot): Promise<PropertySnapshot> {
    const projectId = property.project ? await this.upsertProject(property) : null;
    const result = await this.pool.query<{ id: string }>(
      `
        insert into properties (
          id,
          tenant_id,
          project_id,
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
          $13,
          st_setsrid(st_makepoint($14, $15), 4326)::geography,
          $15,
          $14,
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
        returning id
      `,
      [
        property.id,
        property.tenantId,
        projectId,
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

    return (await this.findById(property.tenantId, result.rows[0].id))!;
  }

  async findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        ${this.selectPropertiesSql()}
        where p.tenant_id = $1 and p.id = $2
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
    const result = await this.pool.query<{ id: string }>(
      `
        update properties
        set title = $3,
            description = $4,
            updated_at = $5
        where tenant_id = $1 and id = $2
        returning id
      `,
      [tenantId, propertyId, title, description, new Date().toISOString()]
    );

    return result.rows[0] ? this.findById(tenantId, result.rows[0].id) : null;
  }

  async updateAmenities(tenantId: string, propertyId: string, amenities: string[]): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<{ id: string }>(
      `
        update properties
        set amenities = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning id
      `,
      [tenantId, propertyId, amenities, new Date().toISOString()]
    );

    return result.rows[0] ? this.findById(tenantId, result.rows[0].id) : null;
  }

  async updatePrice(tenantId: string, propertyId: string, price: Money): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<{ id: string }>(
      `
        update properties
        set price_amount = $3,
            price_currency = $4,
            updated_at = $5
        where tenant_id = $1 and id = $2
        returning id
      `,
      [tenantId, propertyId, price.amount, price.currency, new Date().toISOString()]
    );

    return result.rows[0] ? this.findById(tenantId, result.rows[0].id) : null;
  }

  async updateProject(
    tenantId: string,
    propertyId: string,
    project: UpdatePropertyProjectRequest["project"]
  ): Promise<PropertySnapshot | null> {
    if (!project) {
      const result = await this.pool.query<{ id: string }>(
        `
          update properties
          set project_id = null,
              updated_at = $3
          where tenant_id = $1 and id = $2
          returning id
        `,
        [tenantId, propertyId, new Date().toISOString()]
      );

      return result.rows[0] ? this.findById(tenantId, result.rows[0].id) : null;
    }

    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const context = await client.query<PropertyProjectContextRow>(
        `
          select market, latitude, longitude
          from properties
          where tenant_id = $1 and id = $2
          limit 1
        `,
        [tenantId, propertyId]
      );

      if (!context.rows[0]) {
        await client.query("rollback");
        return null;
      }

      const now = new Date().toISOString();
      const projectId = await this.upsertProjectRecord(client, {
        address: project.address,
        amenities: project.amenities ?? [],
        completionYear: project.completionYear,
        developer: project.developer,
        location: { latitude: context.rows[0].latitude, longitude: context.rows[0].longitude },
        market: context.rows[0].market,
        name: project.name,
        status: project.status ?? "completed",
        tenantId,
        timestamp: now
      });

      await client.query(
        `
          update properties
          set project_id = $3,
              updated_at = $4
          where tenant_id = $1 and id = $2
        `,
        [tenantId, propertyId, projectId, now]
      );

      await client.query("commit");
      return this.findById(tenantId, propertyId);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    tenantId: string,
    propertyId: string,
    status: PropertyStatus
  ): Promise<PropertySnapshot | null> {
    const result = await this.pool.query<{ id: string }>(
      `
        update properties
        set status = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning id
      `,
      [tenantId, propertyId, status, new Date().toISOString()]
    );

    return result.rows[0] ? this.findById(tenantId, result.rows[0].id) : null;
  }

  async list(tenantId: string): Promise<PropertySnapshot[]> {
    return this.search(tenantId, {});
  }

  async search(tenantId: string, filters: PropertySearchRequest): Promise<PropertySnapshot[]> {
    return (await this.searchPage(tenantId, filters)).items;
  }

  async searchPage(tenantId: string, filters: PropertySearchRequest): Promise<PropertySearchResponse> {
    const clauses = ["p.tenant_id = $1"];
    const values: unknown[] = [tenantId];

    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.market) {
      clauses.push(`p.market = ${addValue(filters.market)}`);
    }

    if (filters.listingType) {
      clauses.push(`p.listing_type in (${addValue(filters.listingType)}, 'sale_or_rent')`);
    }

    if (filters.minPriceThb !== undefined) {
      clauses.push(`p.price_currency = 'THB' and p.price_amount >= ${addValue(filters.minPriceThb)}`);
    }

    if (filters.maxPriceThb !== undefined) {
      clauses.push(`p.price_currency = 'THB' and p.price_amount <= ${addValue(filters.maxPriceThb)}`);
    }

    if (filters.minMonthlyRentThb !== undefined) {
      clauses.push(
        `p.rental_price_monthly_currency = 'THB' and p.rental_price_monthly_amount >= ${addValue(filters.minMonthlyRentThb)}`
      );
    }

    if (filters.maxMonthlyRentThb !== undefined) {
      clauses.push(
        `p.rental_price_monthly_currency = 'THB' and p.rental_price_monthly_amount <= ${addValue(filters.maxMonthlyRentThb)}`
      );
    }

    if (filters.minBedrooms !== undefined) {
      clauses.push(`p.bedrooms >= ${addValue(filters.minBedrooms)}`);
    }

    if (filters.minBathrooms !== undefined) {
      clauses.push(`p.bathrooms >= ${addValue(filters.minBathrooms)}`);
    }

    if (filters.minAreaSqm !== undefined) {
      clauses.push(`p.area_sqm >= ${addValue(filters.minAreaSqm)}`);
    }

    if (filters.maxBeachDistanceMeters !== undefined) {
      clauses.push(`p.beach_distance_meters <= ${addValue(filters.maxBeachDistanceMeters)}`);
    }

    if (filters.requiredAmenities?.length) {
      clauses.push(`p.amenities @> ${addValue(filters.requiredAmenities)}::text[]`);
    }

    if (filters.near && filters.radiusMeters !== undefined) {
      const longitude = addValue(filters.near.longitude);
      const latitude = addValue(filters.near.latitude);
      const radius = addValue(filters.radiusMeters);
      clauses.push(`st_dwithin(p.location, st_setsrid(st_makepoint(${longitude}, ${latitude}), 4326)::geography, ${radius})`);
    }

    this.applySmartQuery(clauses, addValue, filters.query);
    const facetValues = [...values];

    if (filters.projectLink === "linked") {
      clauses.push("p.project_id is not null");
    }

    if (filters.projectLink === "missing") {
      clauses.push("p.project_id is null");
    }

    const countValues = [...values];
    const paginationClauses: string[] = [];

    if (filters.limit !== undefined) {
      paginationClauses.push(`limit ${addValue(filters.limit)}`);
    }

    if (filters.offset !== undefined) {
      paginationClauses.push(`offset ${addValue(filters.offset)}`);
    }

    const whereSql = clauses.join(" and ");
    const facetResult = await this.pool.query<{ all_count: string; linked_count: string; missing_count: string }>(
      `
        select
          count(*)::text as all_count,
          count(*) filter (where p.project_id is not null)::text as linked_count,
          count(*) filter (where p.project_id is null)::text as missing_count
        ${this.fromSearchPropertiesSql()}
        where ${clauses.slice(0, filters.projectLink === "linked" || filters.projectLink === "missing" ? -1 : undefined).join(" and ")}
      `,
      facetValues
    );
    const countResult = await this.pool.query<{ count: string }>(
      `
        select count(*)::text as count
        ${this.fromSearchPropertiesSql()}
        where ${whereSql}
      `,
      countValues
    );
    const result = await this.pool.query<PropertyRow>(
      `
        ${this.selectPropertiesSql()}
        where ${whereSql}
        order by ${this.orderBy(filters)}
        ${paginationClauses.join(" ")}
      `,
      values
    );

    return {
      facets: {
        projectLink: {
          all: Number(facetResult.rows[0]?.all_count ?? 0),
          linked: Number(facetResult.rows[0]?.linked_count ?? 0),
          missing: Number(facetResult.rows[0]?.missing_count ?? 0)
        }
      },
      filters,
      items: result.rows.map((row) => this.toSnapshot(row)),
      total: Number(countResult.rows[0]?.count ?? 0)
    };
  }

  async searchProjects(tenantId: string, filters: PropertyProjectSearchRequest): Promise<PropertyProjectSearchResponse> {
    const normalizedQuery = filters.query ? normalizeProjectName(filters.query) : "";
    const values: unknown[] = [tenantId];
    const clauses = ["project.tenant_id = $1"];

    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.market) {
      clauses.push(`project.market = ${addValue(filters.market)}`);
    }

    if (normalizedQuery) {
      clauses.push(`project.normalized_name like ${addValue(`%${normalizedQuery}%`)}`);
    }

    const limit = Math.min(Math.max(filters.limit ?? 8, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const countResult = await this.pool.query<{ count: string }>(
      `
        select count(*)::text as count
        from property_projects project
        where ${clauses.join(" and ")}
      `,
      values
    );
    const statusResult = await this.pool.query<{ count: string; status: PropertyProjectStatus }>(
      `
        select project.status, count(*)::text as count
        from property_projects project
        where ${clauses.join(" and ")}
        group by project.status
        order by count(*) desc, project.status asc
      `,
      values
    );
    const result = await this.pool.query<PropertyProjectSuggestionRow>(
      `
        select
          project.id,
          project.name,
          project.market,
          project.status,
          project.developer,
          project.address,
          count(property.id)::text as listing_count,
          count(property.id) filter (where property.listing_type in ('rent', 'sale_or_rent'))::text as rent_count,
          count(property.id) filter (where property.listing_type in ('sale', 'sale_or_rent'))::text as sale_count
        from property_projects project
        left join properties property
          on property.tenant_id = project.tenant_id and property.project_id = project.id
        where ${clauses.join(" and ")}
        group by project.id
        order by
          case when ${addValue(normalizedQuery)} <> '' and project.normalized_name = ${addValue(normalizedQuery)} then 0 else 1 end,
          case when ${addValue(normalizedQuery)} <> '' and project.normalized_name like ${addValue(`${normalizedQuery}%`)} then 0 else 1 end,
          count(property.id) desc,
          project.name asc
        limit ${addValue(limit)}
        offset ${addValue(offset)}
      `,
      values
    );

    return {
      facets: {
        status: statusResult.rows.map((row) => ({
          count: Number(row.count),
          label: row.status
        }))
      },
      filters,
      items: result.rows.map((row): PropertyProjectSuggestion => ({
        id: row.id,
        name: row.name,
        market: row.market,
        status: row.status,
        developer: row.developer ?? undefined,
        address: row.address ?? undefined,
        listingCount: Number(row.listing_count),
        rentCount: Number(row.rent_count),
        saleCount: Number(row.sale_count)
      })),
      total: Number(countResult.rows[0]?.count ?? 0)
    };
  }

  async createProject(tenantId: string, project: CreatePropertyProjectRequest): Promise<PropertyProjectSuggestion> {
    const timestamp = new Date().toISOString();
    const projectId = await this.upsertProjectRecord(this.pool, {
      address: project.address,
      amenities: project.amenities ?? [],
      completionYear: project.completionYear,
      developer: project.developer,
      market: project.market,
      name: project.name,
      status: project.status ?? "completed",
      tenantId,
      timestamp
    });
    const result = await this.searchProjects(tenantId, {
      limit: 1,
      market: project.market,
      query: project.name
    });

    return (
      result.items.find((item) => item.id === projectId) ??
      result.items[0] ?? {
        id: projectId,
        listingCount: 0,
        market: project.market,
        name: project.name,
        rentCount: 0,
        saleCount: 0,
        status: project.status ?? "completed"
      }
    );
  }

  private orderBy(filters: PropertySearchRequest): string {
    if (filters.sort === "price-asc") {
      return "p.price_amount asc, p.created_at desc";
    }

    if (filters.sort === "price-desc") {
      return "p.price_amount desc, p.created_at desc";
    }

    if (filters.sort === "rent-asc") {
      return "coalesce(p.rental_price_monthly_amount, p.monthly_rent_estimate_amount) asc nulls last, p.created_at desc";
    }

    if (filters.sort === "yield-desc") {
      return `
        case
          when coalesce(p.rental_price_monthly_amount, p.monthly_rent_estimate_amount) is not null and p.price_amount > 0
            then coalesce(p.rental_price_monthly_amount, p.monthly_rent_estimate_amount) * 12 / p.price_amount
          else 0
        end desc,
        p.created_at desc
      `;
    }

    if (filters.sort === "beach-asc") {
      return "p.beach_distance_meters asc nulls last, p.created_at desc";
    }

    if (filters.sort === "ai-fit") {
      return `
        (
          case when p.status = 'available' then 40 else 10 end
          + case
              when p.beach_distance_meters is not null then greatest(0, 25 - p.beach_distance_meters::numeric / 100)
              else 0
            end
          + case when p.amenities && array['fiber-internet', 'coworking-lounge']::text[] then 12 else 0 end
          + case when p.amenities && array['sea-view', 'beachfront']::text[] then 10 else 0 end
          + least(
              18,
              case
                when p.monthly_rent_estimate_amount is not null and p.price_amount > 0
                  then p.monthly_rent_estimate_amount * 12 / p.price_amount * 200
                else 0
              end
            )
        ) desc,
        p.created_at desc
      `;
    }

    return "p.created_at desc";
  }

  private applySmartQuery(clauses: string[], addValue: (value: unknown) => string, query?: string) {
    const parsed = parseInventoryQuery(query);

    if (!parsed.raw) {
      return;
    }

    if (parsed.bedrooms !== undefined) {
      clauses.push(`p.bedrooms = ${addValue(parsed.bedrooms)}`);
    }

    if (parsed.maxRentMonthly !== undefined) {
      clauses.push(
        `coalesce(p.rental_price_monthly_amount, p.monthly_rent_estimate_amount) <= ${addValue(parsed.maxRentMonthly)}`
      );
    }

    if (parsed.maxPrice !== undefined) {
      clauses.push(`p.price_amount <= ${addValue(parsed.maxPrice)}`);
    }

    if (parsed.requiresMissingProject) {
      clauses.push("p.project_id is null");
    }

    parsed.tokens.forEach((token) => {
      clauses.push(`
        concat_ws(
          ' ',
          p.title,
          p.description,
          p.kind,
          p.listing_type,
          p.market,
          p.status,
          p.address,
          project.name,
          project.developer,
          array_to_string(p.amenities, ' ')
        ) ilike ${addValue(`%${token}%`)}
      `);
    });
  }

  private async upsertProject(property: PropertySnapshot): Promise<string> {
    const project = property.project!;
    return this.upsertProjectRecord(this.pool, {
      address: project.address,
      amenities: project.amenities,
      completionYear: project.completionYear,
      developer: project.developer,
      id: project.id,
      location: project.location,
      market: project.market,
      name: project.name,
      status: project.status,
      tenantId: property.tenantId,
      timestamp: project.updatedAt
    });
  }

  private async upsertProjectRecord(
    client: Pick<Pool, "query">,
    project: {
      address?: string;
      amenities: string[];
      completionYear?: number;
      developer?: string;
      id?: string;
      location?: { latitude: number; longitude: number };
      market: ThailandMarket;
      name: string;
      status: PropertyProjectStatus;
      tenantId: string;
      timestamp: string;
    }
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
        insert into property_projects (
          id,
          tenant_id,
          name,
          normalized_name,
          market,
          status,
          developer,
          address,
          completion_year,
          location,
          latitude,
          longitude,
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
          case when $10::double precision is null or $11::double precision is null
            then null
            else st_setsrid(st_makepoint($11, $10), 4326)::geography
          end,
          $10,
          $11,
          $12,
          $13,
          $14
        )
        on conflict (tenant_id, market, normalized_name) do update set
          name = excluded.name,
          status = excluded.status,
          developer = coalesce(excluded.developer, property_projects.developer),
          address = coalesce(excluded.address, property_projects.address),
          completion_year = coalesce(excluded.completion_year, property_projects.completion_year),
          location = coalesce(excluded.location, property_projects.location),
          latitude = coalesce(excluded.latitude, property_projects.latitude),
          longitude = coalesce(excluded.longitude, property_projects.longitude),
          amenities = case
            when cardinality(excluded.amenities) > 0 then excluded.amenities
            else property_projects.amenities
          end,
          updated_at = excluded.updated_at
        returning id
      `,
      [
        project.id ?? crypto.randomUUID(),
        project.tenantId,
        project.name,
        normalizeProjectName(project.name),
        project.market,
        project.status,
        project.developer ?? null,
        project.address ?? null,
        project.completionYear ?? null,
        project.location?.latitude ?? null,
        project.location?.longitude ?? null,
        project.amenities,
        project.timestamp,
        project.timestamp
      ]
    );

    return result.rows[0].id;
  }

  private selectPropertiesSql() {
    return `
      select
        p.*,
        cover_image.id as cover_image_id,
        cover_image.image_url as cover_image_url,
        cover_image.object_key as cover_object_key,
        project.name as project_name,
        project.market as project_market,
        project.status as project_status,
        project.developer as project_developer,
        project.address as project_address,
        project.completion_year as project_completion_year,
        project.latitude as project_latitude,
        project.longitude as project_longitude,
        project.amenities as project_amenities,
        project.created_at as project_created_at,
        project.updated_at as project_updated_at
      ${this.fromPropertiesSql()}
    `;
  }

  private fromPropertiesSql() {
    return `
      from properties p
      left join lateral (
        select id, image_url, object_key
        from property_images
        where tenant_id = p.tenant_id
          and property_id = p.id
          and deleted_at is null
        order by position asc, created_at asc
        limit 1
      ) cover_image on true
      left join property_projects project
        on project.tenant_id = p.tenant_id and project.id = p.project_id
    `;
  }

  private fromSearchPropertiesSql() {
    return `
      from properties p
      left join property_projects project
        on project.tenant_id = p.tenant_id and project.id = p.project_id
    `;
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
      coverImage:
        row.cover_image_id && row.cover_image_url
          ? {
              id: row.cover_image_id,
              imageUrl: row.cover_image_url,
              objectKey: row.cover_object_key ?? undefined
            }
          : undefined,
      project: row.project_id && row.project_name && row.project_market && row.project_status && row.project_created_at && row.project_updated_at
        ? {
            id: row.project_id,
            tenantId: row.tenant_id,
            name: row.project_name,
            market: row.project_market,
            status: row.project_status,
            developer: row.project_developer ?? undefined,
            address: row.project_address ?? undefined,
            completionYear: row.project_completion_year ?? undefined,
            location:
              row.project_latitude !== null && row.project_longitude !== null
                ? { latitude: row.project_latitude, longitude: row.project_longitude }
                : undefined,
            amenities: row.project_amenities ?? [],
            createdAt: row.project_created_at.toISOString(),
            updatedAt: row.project_updated_at.toISOString()
          }
        : undefined,
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

function normalizeProjectName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(?:the|condo|condominium|village|project|residence|residences)\b/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}
