import { Inject, Injectable } from "@nestjs/common";
import type { PropertyImageSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { AddPropertyImageInput, PropertyImagesRepository } from "../../domain/property-images.repository.js";

interface PropertyImageRow {
  id: string;
  tenant_id: string;
  property_id: string;
  image_url: string;
  bucket: string | null;
  object_key: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  original_filename: string | null;
  caption: string | null;
  position: number;
  created_at: Date;
}

@Injectable()
export class PgPropertyImagesRepository implements PropertyImagesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async add(input: AddPropertyImageInput): Promise<PropertyImageSnapshot> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        insert into property_images (
          id,
          tenant_id,
          property_id,
          image_url,
          bucket,
          object_key,
          mime_type,
          size_bytes,
          original_filename,
          caption,
          position,
          created_at
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
          coalesce($11, (
            select coalesce(max(position) + 1, 0)
            from property_images
            where tenant_id = $2 and property_id = $3
          )),
          $12
        )
        returning id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.propertyId,
        input.imageUrl,
        input.bucket ?? null,
        input.objectKey ?? null,
        input.mimeType ?? null,
        input.sizeBytes ?? null,
        input.originalFilename ?? null,
        input.caption ?? null,
        input.position ?? null,
        new Date().toISOString()
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        select id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at
        from property_images
        where tenant_id = $1 and property_id = $2
        order by position asc, created_at asc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async remove(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        delete from property_images
        where tenant_id = $1 and property_id = $2 and id = $3
        returning id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at
      `,
      [tenantId, propertyId, imageId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  private toSnapshot(row: PropertyImageRow): PropertyImageSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      imageUrl: row.image_url,
      bucket: row.bucket ?? undefined,
      objectKey: row.object_key ?? undefined,
      mimeType: row.mime_type ?? undefined,
      sizeBytes: row.size_bytes ?? undefined,
      originalFilename: row.original_filename ?? undefined,
      caption: row.caption ?? undefined,
      position: row.position,
      createdAt: row.created_at.toISOString()
    };
  }
}
