import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { AcknowledgeSecurityEventRequest } from "@propertyflow/contracts";

export class AcknowledgeSecurityEventDto implements AcknowledgeSecurityEventRequest {
  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
