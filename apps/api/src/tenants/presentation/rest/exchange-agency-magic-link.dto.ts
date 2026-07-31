import { ApiProperty } from "@nestjs/swagger";
import type { ExchangeAgencyMagicLinkRequest } from "@propertyflow/contracts";
import { IsString, MinLength } from "class-validator";

export class ExchangeAgencyMagicLinkDto implements ExchangeAgencyMagicLinkRequest {
  @ApiProperty({ example: "demo-agency", minLength: 2 })
  @IsString()
  @MinLength(2)
  tenantSlug!: string;

  @ApiProperty({ minLength: 16 })
  @IsString()
  @MinLength(16)
  token!: string;
}
