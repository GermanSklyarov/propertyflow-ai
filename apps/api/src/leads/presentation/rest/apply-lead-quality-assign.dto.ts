import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { ApplyLeadQualityAssignRequest } from "@propertyflow/contracts";

export class ApplyLeadQualityAssignDto implements ApplyLeadQualityAssignRequest {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  assignedAgentId!: string;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note?: string;
}
