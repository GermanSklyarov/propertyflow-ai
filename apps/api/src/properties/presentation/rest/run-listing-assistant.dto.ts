import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type { RunListingAssistantRequest } from "@propertyflow/contracts";

const locales = ["en", "ru", "th", "zh"] as const;

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
}
