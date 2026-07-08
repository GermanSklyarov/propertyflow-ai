import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { ApplyLeadQualityFollowUpRequest, LeadPriority } from "@propertyflow/contracts";

const leadPriorities: LeadPriority[] = ["low", "medium", "high"];

export class ApplyLeadQualityFollowUpDto implements ApplyLeadQualityFollowUpRequest {
  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  nextFollowUpAt!: string;

  @ApiProperty({ required: false, enum: leadPriorities })
  @IsOptional()
  @IsIn(leadPriorities)
  priority?: LeadPriority;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note?: string;
}
