import { Inject, Injectable } from "@nestjs/common";
import type { PropertyImageSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  AddPropertyImageInput,
  ConsumePropertyImageDeleteConfirmationInput,
  PropertyImageDeleteConfirmationInput,
  PropertyImagesRepository
} from "../../domain/property-images.repository.js";

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
  deleted_at: Date | null;
}

interface ConsumeConfirmationRow {
  id: string;
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
        returning id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
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

  async createDeleteConfirmation(input: PropertyImageDeleteConfirmationInput): Promise<void> {
    await this.pool.query(
      `
        insert into property_image_delete_confirmations (
          id,
          tenant_id,
          property_id,
          image_id,
          token_hash,
          requested_by_user_id,
          expires_at,
          created_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.propertyId,
        input.imageId,
        input.tokenHash,
        input.requestedByUserId ?? null,
        input.expiresAt.toISOString(),
        new Date().toISOString()
      ]
    );
  }

  async findById(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        select id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
        from property_images
        where tenant_id = $1 and property_id = $2 and id = $3 and deleted_at is null
        limit 1
      `,
      [tenantId, propertyId, imageId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async findByIdIncludingDeleted(
    tenantId: string,
    propertyId: string,
    imageId: string
  ): Promise<PropertyImageSnapshot | null> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        select id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
        from property_images
        where tenant_id = $1 and property_id = $2 and id = $3
        limit 1
      `,
      [tenantId, propertyId, imageId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        select id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
        from property_images
        where tenant_id = $1 and property_id = $2 and deleted_at is null
        order by position asc, created_at asc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async listDeletedByPropertyId(tenantId: string, propertyId: string): Promise<PropertyImageSnapshot[]> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        select id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
        from property_images
        where tenant_id = $1 and property_id = $2 and deleted_at is not null
        order by deleted_at desc, position asc, created_at asc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async consumeDeleteConfirmation(input: ConsumePropertyImageDeleteConfirmationInput): Promise<boolean> {
    const result = await this.pool.query<ConsumeConfirmationRow>(
      `
        update property_image_delete_confirmations
        set consumed_at = $5
        where tenant_id = $1
          and property_id = $2
          and image_id = $3
          and token_hash = $4
          and consumed_at is null
          and expires_at > $5
        returning id
      `,
      [input.tenantId, input.propertyId, input.imageId, input.tokenHash, new Date().toISOString()]
    );

    return result.rowCount === 1;
  }

  async remove(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        update property_images
        set deleted_at = $4
        where tenant_id = $1 and property_id = $2 and id = $3
          and deleted_at is null
        returning id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
      `,
      [tenantId, propertyId, imageId, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async restore(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const result = await this.pool.query<PropertyImageRow>(
      `
        update property_images
        set deleted_at = null
        where tenant_id = $1 and property_id = $2 and id = $3
          and deleted_at is not null
        returning id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
      `,
      [tenantId, propertyId, imageId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async makeCover(tenantId: string, propertyId: string, imageId: string): Promise<PropertyImageSnapshot | null> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const selected = await client.query<{ position: number }>(
        `
          select position
          from property_images
          where tenant_id = $1
            and property_id = $2
            and id = $3
            and deleted_at is null
          for update
        `,
        [tenantId, propertyId, imageId]
      );

      if (!selected.rows[0]) {
        await client.query("rollback");
        return null;
      }

      const currentPosition = selected.rows[0].position;

      await client.query(
        `
          update property_images
          set position = position + 1
          where tenant_id = $1
            and property_id = $2
            and id <> $3
            and deleted_at is null
            and position >= 0
            and position < $4
        `,
        [tenantId, propertyId, imageId, currentPosition]
      );

      const result = await client.query<PropertyImageRow>(
        `
          update property_images
          set position = 0
          where tenant_id = $1
            and property_id = $2
            and id = $3
            and deleted_at is null
          returning id, tenant_id, property_id, image_url, bucket, object_key, mime_type, size_bytes, original_filename, caption, position, created_at, deleted_at
        `,
        [tenantId, propertyId, imageId]
      );

      await client.query("commit");

      return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
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
      createdAt: row.created_at.toISOString(),
      deletedAt: row.deleted_at?.toISOString()
    };
  }
}
