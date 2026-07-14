import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import type { UpdatePropertyProjectRequest } from "@propertyflow/contracts";
import type { PropertyProjectStatus } from "@propertyflow/domain";

const projectStatuses: PropertyProjectStatus[] = ["planned", "under_construction", "completed", "paused"];

class UpdatePropertyProjectInputDto {
  @IsString()
  name!: string;

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

export class UpdatePropertyProjectDto implements UpdatePropertyProjectRequest {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePropertyProjectInputDto)
  project?: UpdatePropertyProjectInputDto | null;

  @IsOptional()
  @IsString()
  note?: string;
}
