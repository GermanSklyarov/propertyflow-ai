import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import type { UpdateTenantSettingsRequest } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export class UpdateTenantBrandingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ required: false, example: "#0f766e" })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateTenantSettingsDto implements UpdateTenantSettingsRequest {
  @ApiProperty({ required: false, enum: markets })
  @IsOptional()
  @IsIn(markets)
  primaryMarket?: ThailandMarket;

  @ApiProperty({ required: false, example: "demo.propertyflow.local" })
  @IsOptional()
  @Matches(/^[a-z0-9.-]+$/)
  customDomain?: string;

  @ApiProperty({ required: false, type: UpdateTenantBrandingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantBrandingDto)
  branding?: UpdateTenantBrandingDto;
}
