import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import type { CreatePropertyProjectRequest } from "@propertyflow/contracts";
import type { PropertyProjectStatus, ThailandMarket } from "@propertyflow/domain";

const projectStatuses: PropertyProjectStatus[] = ["planned", "under_construction", "completed", "paused"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export class CreatePropertyProjectDto implements CreatePropertyProjectRequest {
  @IsString()
  name!: string;

  @IsIn(thailandMarkets)
  market!: ThailandMarket;

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
