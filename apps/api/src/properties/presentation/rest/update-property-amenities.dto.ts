import { IsArray, IsOptional, IsString } from "class-validator";
import type { UpdatePropertyAmenitiesRequest } from "@propertyflow/contracts";

export class UpdatePropertyAmenitiesDto implements UpdatePropertyAmenitiesRequest {
  @IsArray()
  @IsString({ each: true })
  amenities!: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
