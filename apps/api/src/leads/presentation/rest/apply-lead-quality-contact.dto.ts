import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { ApplyLeadQualityContactRequest } from "@propertyflow/contracts";

export class ApplyLeadQualityContactDto implements ApplyLeadQualityContactRequest {
  @ApiProperty({ required: false, type: String, format: "email" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  @MinLength(4)
  contactPhone?: string;

  @ApiProperty({ required: false, type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note?: string;
}
