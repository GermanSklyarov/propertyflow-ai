import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from "class-validator";
import type { LeadPriority, LeadSource, LeadStatus, ListLeadsRequest } from "@propertyflow/contracts";

const leadStatuses = ["new", "contacted", "qualified", "lost", "won"] as const satisfies readonly LeadStatus[];
const leadSources = [
  "website",
  "public-api",
  "agent",
  "ai-chat",
  "ai-concierge",
  "saved-search",
  "social-post"
] as const satisfies readonly LeadSource[];
const leadPriorities = ["low", "medium", "high"] as const satisfies readonly LeadPriority[];

export class ListLeadsDto implements ListLeadsRequest {
  @ApiProperty({ required: false, enum: leadStatuses })
  @IsOptional()
  @IsEnum(leadStatuses)
  status?: LeadStatus;

  @ApiProperty({ required: false, enum: leadSources })
  @IsOptional()
  @IsEnum(leadSources)
  source?: LeadSource;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }: { value: string | boolean | undefined }) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    return value === true || value === "true";
  })
  @IsBoolean()
  unassigned?: boolean;

  @ApiProperty({ required: false, enum: leadPriorities })
  @IsOptional()
  @IsEnum(leadPriorities)
  priority?: LeadPriority;

  @ApiProperty({ required: false, format: "date-time" })
  @IsOptional()
  @IsISO8601()
  followUpDueBefore?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    return Number(value);
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
