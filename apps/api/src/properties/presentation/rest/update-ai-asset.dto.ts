import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import type {
  UpdateGeneratedPropertyDescriptionRequest,
  UpdatePropertyImageAnalysisRequest
} from "@propertyflow/contracts";

export class UpdateGeneratedPropertyDescriptionDto implements UpdateGeneratedPropertyDescriptionRequest {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePropertyImageAnalysisDto implements UpdatePropertyImageAnalysisRequest {
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  detectedFeatures!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
