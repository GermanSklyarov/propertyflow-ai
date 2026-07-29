import { BadRequestException } from "@nestjs/common";
import type { EmbedKnowledgeChunksRequest, KnowledgeChunkEmbeddingJobPayload } from "@propertyflow/contracts";
import type { KnowledgeEmbeddingConfig } from "@propertyflow/domain";

type ResolvedEmbeddingJobConfig = Pick<KnowledgeChunkEmbeddingJobPayload, "provider" | "model" | "dimensions">;

export function resolveKnowledgeEmbeddingJobConfig(
  payload: EmbedKnowledgeChunksRequest,
  activeConfig: KnowledgeEmbeddingConfig
): ResolvedEmbeddingJobConfig {
  const hasExplicitConfig = payload.provider !== undefined || payload.model !== undefined || payload.dimensions !== undefined;

  if (!hasExplicitConfig) {
    return activeConfig;
  }

  if (!payload.provider || !payload.model || !payload.dimensions) {
    throw new BadRequestException("Embedding provider, model, and dimensions must be provided together.");
  }

  return {
    provider: payload.provider,
    model: payload.model,
    dimensions: payload.dimensions
  };
}
