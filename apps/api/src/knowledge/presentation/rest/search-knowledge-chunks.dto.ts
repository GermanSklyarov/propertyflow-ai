import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { KnowledgeChunkSearchRequest, KnowledgeDocumentKind } from "@propertyflow/contracts";

const locales = ["en", "ru", "th", "zh"] as const;
const knowledgeKinds = ["article", "neighborhood", "relocation", "legal", "investment", "faq"] as const;

export class SearchKnowledgeChunksDto implements KnowledgeChunkSearchRequest {
  @ApiProperty()
  @IsString()
  query!: string;

  @ApiProperty({ required: false, enum: locales })
  @IsOptional()
  @IsIn(locales)
  locale?: KnowledgeChunkSearchRequest["locale"];

  @ApiProperty({ required: false, enum: knowledgeKinds })
  @IsOptional()
  @IsIn(knowledgeKinds)
  kind?: KnowledgeDocumentKind;

  @ApiProperty({ required: false, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
