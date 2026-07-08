import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional } from "class-validator";
import type { LeadPriority, UpdateLeadFollowUpRequest } from "@propertyflow/contracts";

const leadPriorities: LeadPriority[] = ["low", "medium", "high"];

export class UpdateLeadFollowUpDto implements UpdateLeadFollowUpRequest {
  @ApiProperty({ required: false, enum: leadPriorities })
  @IsOptional()
  @IsIn(leadPriorities)
  priority?: LeadPriority;

  @ApiProperty({ required: false, nullable: true, format: "date-time" })
  @IsOptional()
  @IsISO8601()
  nextFollowUpAt?: string | null;
}
