import { Inject, Injectable } from "@nestjs/common";
import type {
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageAnalysisResult,
  RequestUser,
  ReviewAiAssetRequest
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PropertyAiAssetsRepository } from "../../domain/property-ai-assets.repository.js";

interface DescriptionRow {
  id: string;
  property_id: string;
  locale: GeneratedPropertyDescription["locale"];
  title: string;
  description: string;
  source: GeneratedPropertyDescription["source"];
  review_status: GeneratedPropertyDescription["reviewStatus"];
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
}

interface ImageAnalysisRow {
  id: string;
  property_id: string;
  image_url: string;
  detected_features: string[];
  confidence: string;
  review_status: PropertyImageAnalysisResult["reviewStatus"];
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
}

@Injectable()
export class PgPropertyAiAssetsRepository implements PropertyAiAssetsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets> {
    const [descriptions, imageAnalysis] = await Promise.all([
      this.pool.query<DescriptionRow>(
        `
          select id, property_id, locale, title, description, source, review_status, reviewed_by_user_id, reviewed_at, review_note, created_at
          from property_generated_descriptions
          where tenant_id = $1 and property_id = $2
          order by created_at desc, locale asc
        `,
        [tenantId, propertyId]
      ),
      this.pool.query<ImageAnalysisRow>(
        `
          select id, property_id, image_url, detected_features, confidence, review_status, reviewed_by_user_id, reviewed_at, review_note, created_at
          from property_image_analysis
          where tenant_id = $1 and property_id = $2
          order by created_at desc, image_url asc
        `,
        [tenantId, propertyId]
      )
    ]);

    return {
      propertyId,
      descriptions: descriptions.rows.map((row) => this.toDescription(row)),
      imageAnalysis: imageAnalysis.rows.map((row) => this.toImageAnalysis(row))
    };
  }

  async reviewDescription(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<GeneratedPropertyDescription | null> {
    const result = await this.pool.query<DescriptionRow>(
      `
        update property_generated_descriptions
        set review_status = $4,
            reviewed_by_user_id = $5,
            reviewed_at = $6,
            review_note = $7
        where tenant_id = $1 and property_id = $2 and id = $3
        returning id, property_id, locale, title, description, source, review_status, reviewed_by_user_id, reviewed_at, review_note, created_at
      `,
      [tenantId, propertyId, assetId, request.status, user.id, new Date().toISOString(), request.note ?? null]
    );

    return result.rows[0] ? this.toDescription(result.rows[0]) : null;
  }

  async reviewImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<PropertyImageAnalysisResult | null> {
    const result = await this.pool.query<ImageAnalysisRow>(
      `
        update property_image_analysis
        set review_status = $4,
            reviewed_by_user_id = $5,
            reviewed_at = $6,
            review_note = $7
        where tenant_id = $1 and property_id = $2 and id = $3
        returning id, property_id, image_url, detected_features, confidence, review_status, reviewed_by_user_id, reviewed_at, review_note, created_at
      `,
      [tenantId, propertyId, assetId, request.status, user.id, new Date().toISOString(), request.note ?? null]
    );

    return result.rows[0] ? this.toImageAnalysis(result.rows[0]) : null;
  }

  private toDescription(row: DescriptionRow): GeneratedPropertyDescription {
    return {
      id: row.id,
      propertyId: row.property_id,
      locale: row.locale,
      title: row.title,
      description: row.description,
      source: row.source,
      reviewStatus: row.review_status,
      reviewedByUserId: row.reviewed_by_user_id ?? undefined,
      reviewedAt: row.reviewed_at?.toISOString(),
      reviewNote: row.review_note ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }

  private toImageAnalysis(row: ImageAnalysisRow): PropertyImageAnalysisResult {
    return {
      id: row.id,
      propertyId: row.property_id,
      imageUrl: row.image_url,
      detectedFeatures: row.detected_features,
      confidence: Number(row.confidence),
      reviewStatus: row.review_status,
      reviewedByUserId: row.reviewed_by_user_id ?? undefined,
      reviewedAt: row.reviewed_at?.toISOString(),
      reviewNote: row.review_note ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }
}
