import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CreateAgencySessionRequest } from "@propertyflow/contracts";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAgencySessionDto implements CreateAgencySessionRequest {
  @ApiProperty({ example: "demo-agency", minLength: 2 })
  @IsString()
  @MinLength(2)
  tenantSlug!: string;

  @ApiProperty({ example: "owner@agency.co.th" })
  @IsEmail()
  workEmail!: string;

  @ApiPropertyOptional({
    description: "Local-development bootstrap code. Production agency sign-in uses one-time magic links."
  })
  @IsOptional()
  @IsString()
  bootstrapCode?: string;
}
