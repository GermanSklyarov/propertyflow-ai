import { ApiProperty } from "@nestjs/swagger";
import type {
  BackgroundJobName,
  ConciergeModelTrainJobPayload,
  CreatePropertyImportUploadRequest,
  EnqueueBackgroundJobRequest,
  KnowledgeChunkEmbeddingJobPayload,
  KnowledgeDocumentIngestJobPayload,
  PricingModelTrainJobPayload,
  PropertyAiDescriptionJobPayload,
  PropertyImageAnalysisJobPayload,
  PropertyImportJobPayload,
  PropertySearchIndexJobPayload,
  SavedSearchAlertDigestJobPayload
} from "@propertyflow/contracts";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const jobNames = [
  "knowledge.chunks.embed",
  "knowledge.documents.ingest",
  "concierge.model.train",
  "pricing.model.train",
  "properties.import",
  "properties.ai_description.generate",
  "properties.images.analyze",
  "saved_search.alerts.digest",
  "properties.search.index"
] as const satisfies readonly BackgroundJobName[];

const locales = ["en", "ru", "th", "zh"] as const;

export class EnqueueBackgroundJobDto implements EnqueueBackgroundJobRequest {
  @ApiProperty({ enum: jobNames })
  @IsIn(jobNames)
  name!: BackgroundJobName;

  @ApiProperty({
    oneOf: [
      { $ref: "#/components/schemas/KnowledgeChunkEmbeddingPayloadDto" },
      { $ref: "#/components/schemas/KnowledgeDocumentIngestPayloadDto" },
      { $ref: "#/components/schemas/ConciergeModelTrainPayloadDto" },
      { $ref: "#/components/schemas/PropertyImportPayloadDto" },
      { $ref: "#/components/schemas/PricingModelTrainPayloadDto" },
      { $ref: "#/components/schemas/PropertyAiDescriptionPayloadDto" },
      { $ref: "#/components/schemas/PropertyImageAnalysisPayloadDto" },
      { $ref: "#/components/schemas/SavedSearchAlertDigestPayloadDto" },
      { $ref: "#/components/schemas/PropertySearchIndexPayloadDto" }
    ]
  })
  payload!:
    | KnowledgeChunkEmbeddingPayloadDto
    | KnowledgeDocumentIngestPayloadDto
    | ConciergeModelTrainPayloadDto
    | PricingModelTrainPayloadDto
    | PropertyImportPayloadDto
    | PropertyAiDescriptionPayloadDto
    | PropertyImageAnalysisPayloadDto
    | SavedSearchAlertDigestPayloadDto
    | PropertySearchIndexPayloadDto;
}

export class KnowledgeChunkEmbeddingPayloadDto implements KnowledgeChunkEmbeddingJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiProperty({ enum: ["local-hash", "openai", "anthropic", "gemini"] })
  @IsIn(["local-hash", "openai", "anthropic", "gemini"])
  provider!: KnowledgeChunkEmbeddingJobPayload["provider"];

  @ApiProperty({ type: String })
  @IsString()
  model!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 4096 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  dimensions!: number;

  @ApiProperty({ required: false, type: Number, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class KnowledgeDocumentIngestPayloadDto implements KnowledgeDocumentIngestJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ type: String })
  @IsString()
  documentId!: string;

  @ApiProperty({ enum: ["created", "updated", "manual"] })
  @IsIn(["created", "updated", "manual"])
  reason!: KnowledgeDocumentIngestJobPayload["reason"];
}

export class ConciergeModelTrainPayloadDto implements ConciergeModelTrainJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ type: String })
  @IsString()
  modelVersion!: string;

  @ApiProperty({ enum: ["baseline-refresh", "llm-reranker", "learning-to-rank"] })
  @IsIn(["baseline-refresh", "llm-reranker", "learning-to-rank"])
  algorithm!: ConciergeModelTrainJobPayload["algorithm"];

  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class PricingModelTrainPayloadDto implements PricingModelTrainJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ type: String })
  @IsString()
  modelVersion!: string;

  @ApiProperty({ enum: ["baseline-refresh", "catboost", "lightgbm"] })
  @IsIn(["baseline-refresh", "catboost", "lightgbm"])
  algorithm!: PricingModelTrainJobPayload["algorithm"];

  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class PropertyImportPayloadDto implements PropertyImportJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ enum: ["csv", "json", "partner-api"] })
  @IsIn(["csv", "json", "partner-api"])
  source!: "csv" | "json" | "partner-api";

  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  objectUrl?: string;

  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class CreatePropertyImportUploadDto implements CreatePropertyImportUploadRequest {
  @ApiProperty({ type: String })
  @IsString()
  filename!: string;

  @ApiProperty({ type: String })
  @IsString()
  mimeType!: string;

  @ApiProperty({ required: false, type: Number, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

export class PropertyAiDescriptionPayloadDto implements PropertyAiDescriptionJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ type: String })
  @IsString()
  propertyId!: string;

  @ApiProperty({ enum: locales, isArray: true })
  @IsArray()
  @IsIn(locales, { each: true })
  locales!: Array<"en" | "ru" | "th" | "zh">;
}

export class PropertyImageAnalysisPayloadDto implements PropertyImageAnalysisJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ type: String })
  @IsString()
  propertyId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageIds?: string[];
}

export class PropertySearchIndexPayloadDto implements PropertySearchIndexJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ type: String })
  @IsString()
  propertyId!: string;

  @ApiProperty({ enum: ["created", "updated", "manual"] })
  @IsIn(["created", "updated", "manual"])
  reason!: "created" | "updated" | "manual";
}

export class SavedSearchAlertDigestPayloadDto implements SavedSearchAlertDigestJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty({ enum: ["user", "tenant"] })
  @IsIn(["user", "tenant"])
  scope!: SavedSearchAlertDigestJobPayload["scope"];

  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({ required: false, type: Number, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export function withTenantJobContext(
  tenantId: string,
  requestedByUserId: string | undefined,
  request: EnqueueBackgroundJobDto
): EnqueueBackgroundJobRequest {
  return {
    name: request.name,
    payload: {
      ...request.payload,
      tenantId,
      requestedByUserId
    } as EnqueueBackgroundJobRequest["payload"]
  };
}
