import { Type } from "class-transformer";
import { IsInt, IsMimeType, IsOptional, IsString, Max, Min } from "class-validator";
import type { CreateKnowledgeDocumentUploadRequest } from "@propertyflow/contracts";

export class CreateKnowledgeDocumentUploadDto implements CreateKnowledgeDocumentUploadRequest {
  @IsString()
  filename!: string;

  @IsMimeType()
  mimeType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50_000_000)
  sizeBytes?: number;
}
