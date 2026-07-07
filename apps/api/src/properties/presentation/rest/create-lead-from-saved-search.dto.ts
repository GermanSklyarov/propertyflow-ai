import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateLeadFromSavedSearchRequest } from "@propertyflow/contracts";

const locales: NonNullable<CreateLeadFromSavedSearchRequest["preferredLocale"]>[] = ["en", "ru", "th", "zh"];

export class CreateLeadFromSavedSearchDto implements CreateLeadFromSavedSearchRequest {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  contactName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false, enum: locales })
  @IsOptional()
  @IsIn(locales)
  preferredLocale?: CreateLeadFromSavedSearchRequest["preferredLocale"];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;
}
