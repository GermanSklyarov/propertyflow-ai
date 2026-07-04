import { Inject, Injectable } from "@nestjs/common";
import type {
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageAnalysisResult
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
  created_at: Date;
}

interface ImageAnalysisRow {
  id: string;
  property_id: string;
  image_url: string;
  detected_features: string[];
  confidence: string;
  created_at: Date;
}

@Injectable()
export class PgPropertyAiAssetsRepository implements PropertyAiAssetsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets> {
    const [descriptions, imageAnalysis] = await Promise.all([
      this.pool.query<DescriptionRow>(
        `
          select id, property_id, locale, title, description, source, created_at
          from property_generated_descriptions
          where tenant_id = $1 and property_id = $2
          order by created_at desc, locale asc
        `,
        [tenantId, propertyId]
      ),
      this.pool.query<ImageAnalysisRow>(
        `
          select id, property_id, image_url, detected_features, confidence, created_at
          from property_image_analysis
          where tenant_id = $1 and property_id = $2
          order by created_at desc, image_url asc
        `,
        [tenantId, propertyId]
      )
    ]);

    return {
      propertyId,
      descriptions: descriptions.rows.map((row) => ({
        id: row.id,
        propertyId: row.property_id,
        locale: row.locale,
        title: row.title,
        description: row.description,
        source: row.source,
        createdAt: row.created_at.toISOString()
      })),
      imageAnalysis: imageAnalysis.rows.map((row) => ({
        id: row.id,
        propertyId: row.property_id,
        imageUrl: row.image_url,
        detectedFeatures: row.detected_features,
        confidence: Number(row.confidence),
        createdAt: row.created_at.toISOString()
      }))
    };
  }
}
