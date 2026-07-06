import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type {
  TenantSecurityEventKind,
  TenantSecurityEventsRequest,
  TenantSecurityEventSeverity
} from "@propertyflow/contracts";

const securityEventKinds = [
  "rejected-job-enqueue",
  "blocked-ai-action",
  "image-delete-previewed",
  "image-removed"
] as const satisfies readonly TenantSecurityEventKind[];

const securityEventSeverities = ["info", "warning", "critical"] as const satisfies readonly TenantSecurityEventSeverity[];

export class ListSecurityEventsDto implements TenantSecurityEventsRequest {
  @ApiProperty({ required: false, enum: securityEventKinds })
  @IsOptional()
  @IsIn(securityEventKinds)
  kind?: TenantSecurityEventKind;

  @ApiProperty({ required: false, enum: securityEventSeverities })
  @IsOptional()
  @IsIn(securityEventSeverities)
  severity?: TenantSecurityEventSeverity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
