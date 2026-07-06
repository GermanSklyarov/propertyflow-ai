import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type { AiAgentActionName, RunListingAssistantRequest } from "@propertyflow/contracts";

const locales = ["en", "ru", "th", "zh"] as const;
const aiAgentActions = [
  "property.ai_description.generate",
  "property.images.analyze",
  "property.ai_description.apply",
  "property.ai_image_analysis.apply",
  "property.image.delete",
  "property.image.restore",
  "property.publish",
  "property.price.update"
] as const satisfies readonly AiAgentActionName[];

export class RunListingAssistantDto implements RunListingAssistantRequest {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  generateDescriptions?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  analyzeImages?: boolean;

  @ApiProperty({ enum: locales, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(locales, { each: true })
  locales?: Array<"en" | "ru" | "th" | "zh">;

  @ApiProperty({ isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiProperty({ enum: aiAgentActions, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(aiAgentActions, { each: true })
  requestedActions?: AiAgentActionName[];
}
