import { Inject, Injectable } from "@nestjs/common";
import type {
  PropertySocialPostChannel,
  PropertySocialPostLocale,
  PropertySocialPostPublication,
  PropertySocialPostUtm,
  RecordPropertySocialPostPublicationRequest,
  RequestUser,
  UserRole
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertySocialPostPublicationsRepository } from "../../domain/property-social-post-publications.repository.js";

interface PropertySocialPostPublicationRow {
  id: string;
  tenant_id: string;
  property_id: string;
  channel: PropertySocialPostChannel;
  locale: PropertySocialPostLocale;
  tracking_slug: string;
  published_url: string | null;
  utm: PropertySocialPostUtm;
  created_by_user_id: string | null;
  created_by_user_role: UserRole | null;
  published_at: Date;
}

@Injectable()
export class PgPropertySocialPostPublicationsRepository implements PropertySocialPostPublicationsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async record(
    tenantId: string,
    propertyId: string,
    request: RecordPropertySocialPostPublicationRequest,
    user: RequestUser
  ): Promise<PropertySocialPostPublication> {
    const result = await this.pool.query<PropertySocialPostPublicationRow>(
      `
        insert into property_social_post_publications (
          id,
          tenant_id,
          property_id,
          channel,
          locale,
          tracking_slug,
          published_url,
          utm,
          created_by_user_id,
          created_by_user_role,
          published_at
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
          $11
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        tenantId,
        propertyId,
        request.channel,
        request.locale,
        request.trackingSlug,
        request.publishedUrl ?? null,
        request.utm,
        user.id,
        user.role,
        new Date().toISOString()
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  private toSnapshot(row: PropertySocialPostPublicationRow): PropertySocialPostPublication {
    return {
      channel: row.channel,
      createdByUserId: row.created_by_user_id ?? undefined,
      createdByUserRole: row.created_by_user_role ?? undefined,
      id: row.id,
      locale: row.locale,
      propertyId: row.property_id,
      publishedAt: row.published_at.toISOString(),
      publishedUrl: row.published_url ?? undefined,
      status: "published",
      tenantId: row.tenant_id,
      trackingSlug: row.tracking_slug,
      utm: row.utm
    };
  }
}
