import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import type { UpdatePropertyProjectRecordRequest } from "@propertyflow/contracts";
import type { PropertyProjectStatus } from "@propertyflow/domain";

const projectStatuses: PropertyProjectStatus[] = ["planned", "under_construction", "completed", "paused"];

export class UpdatePropertyProjectRecordDto implements UpdatePropertyProjectRecordRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(projectStatuses)
  status?: PropertyProjectStatus;

  @IsOptional()
  @IsString()
  developer?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  completionYear?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
