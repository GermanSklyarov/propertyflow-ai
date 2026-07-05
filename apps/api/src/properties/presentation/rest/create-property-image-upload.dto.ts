import { IsInt, IsMimeType, IsOptional, IsString, Max, Min } from "class-validator";
import type { CreatePropertyImageUploadRequest } from "@propertyflow/contracts";

export class CreatePropertyImageUploadDto implements CreatePropertyImageUploadRequest {
  @IsString()
  filename!: string;

  @IsMimeType()
  mimeType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25_000_000)
  sizeBytes?: number;
}
