import { Inject, Injectable } from "@nestjs/common";
import type {
  PropertySocialPostChannel,
  PropertySocialPostLocale,
  PropertySocialPostReview,
  PropertySocialPostReviewStatus,
  RecordPropertySocialPostReviewRequest,
  RequestUser,
  UserRole
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertySocialPostReviewsRepository } from "../../domain/property-social-post-reviews.repository.js";

interface PropertySocialPostReviewRow {
  id: string;
  tenant_id: string;
  property_id: string;
  channel: PropertySocialPostChannel;
  locale: PropertySocialPostLocale;
  tracking_slug: string;
  status: PropertySocialPostReviewStatus;
  note: string | null;
  created_by_user_id: string | null;
  created_by_user_role: UserRole | null;
  updated_by_user_id: string | null;
  updated_by_user_role: UserRole | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgPropertySocialPostReviewsRepository implements PropertySocialPostReviewsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertySocialPostReview[]> {
    const result = await this.pool.query<PropertySocialPostReviewRow>(
      `
        select *
        from property_social_post_reviews
        where tenant_id = $1
          and property_id = $2
        order by updated_at desc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async record(
    tenantId: string,
    propertyId: string,
    request: RecordPropertySocialPostReviewRequest,
    user: RequestUser
  ): Promise<PropertySocialPostReview> {
    const now = new Date().toISOString();
    const result = await this.pool.query<PropertySocialPostReviewRow>(
      `
        insert into property_social_post_reviews (
          id,
          tenant_id,
          property_id,
          channel,
          locale,
          tracking_slug,
          status,
          note,
          created_by_user_id,
          created_by_user_role,
          updated_by_user_id,
          updated_by_user_role,
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
          $14
        )
        on conflict (tenant_id, property_id, channel, locale, tracking_slug)
        do update set
          status = excluded.status,
          note = excluded.note,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_by_user_role = excluded.updated_by_user_role,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        crypto.randomUUID(),
        tenantId,
        propertyId,
        request.channel,
        request.locale,
        request.trackingSlug,
        request.status,
        request.note ?? null,
        user.id,
        user.role,
        user.id,
        user.role,
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  private toSnapshot(row: PropertySocialPostReviewRow): PropertySocialPostReview {
    return {
      channel: row.channel,
      createdAt: row.created_at.toISOString(),
      createdByUserId: row.created_by_user_id ?? undefined,
      createdByUserRole: row.created_by_user_role ?? undefined,
      id: row.id,
      locale: row.locale,
      note: row.note ?? undefined,
      propertyId: row.property_id,
      status: row.status,
      tenantId: row.tenant_id,
      trackingSlug: row.tracking_slug,
      updatedAt: row.updated_at.toISOString(),
      updatedByUserId: row.updated_by_user_id ?? undefined,
      updatedByUserRole: row.updated_by_user_role ?? undefined
    };
  }
}
