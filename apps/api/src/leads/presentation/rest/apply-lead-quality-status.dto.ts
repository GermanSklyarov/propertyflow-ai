import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { ApplyLeadQualityStatusRequest, LeadStatus } from "@propertyflow/contracts";

const leadStatuses: LeadStatus[] = ["new", "contacted", "qualified", "lost", "won"];

export class ApplyLeadQualityStatusDto implements ApplyLeadQualityStatusRequest {
  @ApiProperty({ enum: leadStatuses })
  @IsIn(leadStatuses)
  status!: LeadStatus;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note?: string;
}
