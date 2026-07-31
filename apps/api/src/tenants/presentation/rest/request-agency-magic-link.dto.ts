import { ApiProperty } from "@nestjs/swagger";
import type { RequestAgencyMagicLinkRequest } from "@propertyflow/contracts";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RequestAgencyMagicLinkDto implements RequestAgencyMagicLinkRequest {
  @ApiProperty({ example: "demo-agency", minLength: 2 })
  @IsString()
  @MinLength(2)
  tenantSlug!: string;

  @ApiProperty({ example: "owner@agency.co.th" })
  @IsEmail()
  workEmail!: string;
}
