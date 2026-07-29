import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { EmbedKnowledgeChunksRequest } from "@propertyflow/contracts";

export class EmbedKnowledgeChunksDto implements EmbedKnowledgeChunksRequest {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiProperty({
    enum: ["local-hash", "openai", "anthropic", "gemini"],
    required: false,
    description: "Omit provider, model, and dimensions to use the active server embedding configuration."
  })
  @IsOptional()
  @IsIn(["local-hash", "openai", "anthropic", "gemini"])
  provider?: EmbedKnowledgeChunksRequest["provider"];

  @ApiProperty({
    required: false,
    description: "Omit provider, model, and dimensions to use the active server embedding configuration."
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: 4096,
    description: "Omit provider, model, and dimensions to use the active server embedding configuration."
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  dimensions?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiProperty({
    required: false,
    default: false,
    description: "Refresh chunks already embedded with a stale embedding model."
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  refreshExisting?: boolean;
}
