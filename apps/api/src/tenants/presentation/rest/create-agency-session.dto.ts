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
    description: "Bootstrap session code. Production deployments should replace this with OTP or magic-link exchange."
  })
  @IsOptional()
  @IsString()
  bootstrapCode?: string;
}
