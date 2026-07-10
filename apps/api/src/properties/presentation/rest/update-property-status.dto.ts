import { IsIn, IsOptional, IsString } from "class-validator";
import type { UpdatePropertyStatusRequest } from "@propertyflow/contracts";
import type { PropertyStatus } from "@propertyflow/domain";

const propertyStatuses: PropertyStatus[] = ["draft", "available", "reserved", "sold", "rented", "archived"];

export class UpdatePropertyStatusDto implements UpdatePropertyStatusRequest {
  @IsIn(propertyStatuses)
  status!: PropertyStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
