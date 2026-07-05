import { IsBoolean, IsInt, IsMimeType, IsOptional, IsString, Min } from "class-validator";
import type { ConfirmPropertyImageUploadRequest } from "@propertyflow/contracts";

export class ConfirmPropertyImageUploadDto implements ConfirmPropertyImageUploadRequest {
  @IsOptional()
  @IsString()
  bucket?: string;

  @IsString()
  objectKey!: string;

  @IsOptional()
  @IsMimeType()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  originalFilename?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  analyzeImage?: boolean;
}
