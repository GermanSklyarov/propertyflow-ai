import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { ApplyLeadQualityLinkPropertyRequest } from "@propertyflow/contracts";

export class ApplyLeadQualityLinkPropertyDto implements ApplyLeadQualityLinkPropertyRequest {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  propertyId!: string;

  @ApiProperty({ required: false, type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note?: string;
}
