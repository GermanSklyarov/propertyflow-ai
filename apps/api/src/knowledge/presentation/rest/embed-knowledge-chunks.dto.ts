import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { KnowledgeChunkEmbeddingJobPayload } from "@propertyflow/contracts";

export class EmbedKnowledgeChunksDto
  implements Omit<KnowledgeChunkEmbeddingJobPayload, "tenantId" | "requestedByUserId">
{
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiProperty({ enum: ["local-hash", "openai", "anthropic", "gemini"], default: "local-hash" })
  @IsOptional()
  @IsIn(["local-hash", "openai", "anthropic", "gemini"])
  provider: KnowledgeChunkEmbeddingJobPayload["provider"] = "local-hash";

  @ApiProperty({ default: "local-hash-16" })
  @IsOptional()
  @IsString()
  model = "local-hash-16";

  @ApiProperty({ minimum: 1, maximum: 4096, default: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  dimensions = 16;

  @ApiProperty({ required: false, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
