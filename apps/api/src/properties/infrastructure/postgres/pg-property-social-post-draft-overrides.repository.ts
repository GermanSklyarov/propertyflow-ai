import { Inject, Injectable } from "@nestjs/common";
import type {
  PropertySocialPostChannel,
  PropertySocialPostDraftOverride,
  PropertySocialPostLocale,
  SavePropertySocialPostDraftRequest,
  RequestUser,
  UserRole
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertySocialPostDraftOverridesRepository } from "../../domain/property-social-post-draft-overrides.repository.js";

interface PropertySocialPostDraftOverrideRow {
  id: string;
  tenant_id: string;
  property_id: string;
  channel: PropertySocialPostChannel;
  locale: PropertySocialPostLocale;
  tracking_slug: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  created_by_user_id: string | null;
  created_by_user_role: UserRole | null;
  updated_by_user_id: string | null;
  updated_by_user_role: UserRole | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgPropertySocialPostDraftOverridesRepository implements PropertySocialPostDraftOverridesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertySocialPostDraftOverride[]> {
    const result = await this.pool.query<PropertySocialPostDraftOverrideRow>(
      `
        select *
        from property_social_post_draft_overrides
        where tenant_id = $1
          and property_id = $2
        order by updated_at desc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async save(
    tenantId: string,
    propertyId: string,
    request: SavePropertySocialPostDraftRequest,
    user: RequestUser
  ): Promise<PropertySocialPostDraftOverride> {
    const now = new Date().toISOString();
    const result = await this.pool.query<PropertySocialPostDraftOverrideRow>(
      `
        insert into property_social_post_draft_overrides (
          id,
          tenant_id,
          property_id,
          channel,
          locale,
          tracking_slug,
          hook,
          body,
          cta,
          hashtags,
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
          $14,
          $15,
          $16
        )
        on conflict (tenant_id, property_id, channel, locale, tracking_slug)
        do update set
          hook = excluded.hook,
          body = excluded.body,
          cta = excluded.cta,
          hashtags = excluded.hashtags,
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
        request.hook,
        request.body,
        request.cta,
        request.hashtags,
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

  private toSnapshot(row: PropertySocialPostDraftOverrideRow): PropertySocialPostDraftOverride {
    return {
      body: row.body,
      channel: row.channel,
      createdAt: row.created_at.toISOString(),
      createdByUserId: row.created_by_user_id ?? undefined,
      createdByUserRole: row.created_by_user_role ?? undefined,
      cta: row.cta,
      hashtags: row.hashtags,
      hook: row.hook,
      id: row.id,
      locale: row.locale,
      propertyId: row.property_id,
      tenantId: row.tenant_id,
      trackingSlug: row.tracking_slug,
      updatedAt: row.updated_at.toISOString(),
      updatedByUserId: row.updated_by_user_id ?? undefined,
      updatedByUserRole: row.updated_by_user_role ?? undefined
    };
  }
}
