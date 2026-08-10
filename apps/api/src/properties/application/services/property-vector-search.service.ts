import { Inject, Injectable, Logger } from "@nestjs/common";
import { KnowledgeEmbeddingGenerator } from "@propertyflow/domain";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";

export interface PropertyVectorRank {
  propertyId: string;
  rank: number;
  similarityScore: number;
}

@Injectable()
export class PropertyVectorSearchService {
  private readonly logger = new Logger(PropertyVectorSearchService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(KnowledgeEmbeddingGenerator) private readonly embeddings: KnowledgeEmbeddingGenerator
  ) {}

  async rankCandidates(tenantId: string, query: string, propertyIds: string[]): Promise<PropertyVectorRank[]> {
    const uniqueIds = [...new Set(propertyIds.filter(Boolean))];
    const normalizedQuery = query.trim();

    if (!normalizedQuery || uniqueIds.length === 0) {
      return [];
    }

    try {
      const embedding = await this.embeddings.embed(normalizedQuery, "query");
      const result = await this.pool.query<{ property_id: string; similarity_score: string }>(
        `
          select
            property_id::text,
            greatest(0, 1 - (embedding <=> $1::vector))::text as similarity_score
          from property_search_embeddings
          where tenant_id = $2
            and embedding_status = 'embedded'
            and embedding is not null
            and embedding_model = $3
            and property_id = any($4::uuid[])
          order by embedding <=> $1::vector asc
          limit $5
        `,
        [toVectorLiteral(embedding.vector), tenantId, embedding.modelKey, uniqueIds, uniqueIds.length]
      );

      return result.rows.map((row, index) => ({
        propertyId: row.property_id,
        rank: index + 1,
        similarityScore: Number(row.similarity_score)
      }));
    } catch (error) {
      this.logger.warn(
        `Property vector ranking unavailable for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
