import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";
import type { ComparePropertiesRequest } from "@propertyflow/contracts";

export class ComparePropertiesDto implements ComparePropertiesRequest {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  propertyIds!: string[];
}

