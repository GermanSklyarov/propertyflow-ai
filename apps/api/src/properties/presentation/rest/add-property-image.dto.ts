import { IsInt, IsOptional, IsString, IsUrl, Min } from "class-validator";
import type { AddPropertyImageRequest } from "@propertyflow/contracts";

export class AddPropertyImageDto implements AddPropertyImageRequest {
  @IsUrl({ require_tld: false })
  imageUrl!: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
