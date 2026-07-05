import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from "class-validator";
import type {
  BackgroundJobName,
  EnqueueBackgroundJobRequest,
  PricingModelTrainJobPayload,
  PropertyAiDescriptionJobPayload,
  PropertyImageAnalysisJobPayload,
  PropertyImportJobPayload,
  PropertySearchIndexJobPayload
} from "@propertyflow/contracts";

const jobNames = [
  "pricing.model.train",
  "properties.import",
  "properties.ai_description.generate",
  "properties.images.analyze",
  "properties.search.index"
] as const satisfies readonly BackgroundJobName[];

const locales = ["en", "ru", "th", "zh"] as const;

export class EnqueueBackgroundJobDto implements EnqueueBackgroundJobRequest {
  @ApiProperty({ enum: jobNames })
  @IsIn(jobNames)
  name!: BackgroundJobName;

  @ApiProperty({
    oneOf: [
      { $ref: "#/components/schemas/PropertyImportPayloadDto" },
      { $ref: "#/components/schemas/PricingModelTrainPayloadDto" },
      { $ref: "#/components/schemas/PropertyAiDescriptionPayloadDto" },
      { $ref: "#/components/schemas/PropertyImageAnalysisPayloadDto" },
      { $ref: "#/components/schemas/PropertySearchIndexPayloadDto" }
    ]
  })
  payload!:
    | PricingModelTrainPayloadDto
    | PropertyImportPayloadDto
    | PropertyAiDescriptionPayloadDto
    | PropertyImageAnalysisPayloadDto
    | PropertySearchIndexPayloadDto;
}

export class PricingModelTrainPayloadDto implements PricingModelTrainJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty()
  @IsString()
  modelVersion!: string;

  @ApiProperty({ enum: ["baseline-refresh", "catboost", "lightgbm"] })
  @IsIn(["baseline-refresh", "catboost", "lightgbm"])
  algorithm!: PricingModelTrainJobPayload["algorithm"];

  @ApiProperty({ required: false })
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  objectUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class PropertyAiDescriptionPayloadDto implements PropertyAiDescriptionJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty()
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

  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty({ isArray: true })
  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @ApiProperty({ required: false, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageIds?: string[];
}

export class PropertySearchIndexPayloadDto implements PropertySearchIndexJobPayload {
  tenantId!: string;

  requestedByUserId?: string;

  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty({ enum: ["created", "updated", "manual"] })
  @IsIn(["created", "updated", "manual"])
  reason!: "created" | "updated" | "manual";
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
