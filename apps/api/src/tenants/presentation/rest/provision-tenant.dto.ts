import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import type { ProvisionTenantRequest, TenantSubscriptionPlan } from "@propertyflow/contracts";

const subscriptionPlans: TenantSubscriptionPlan[] = ["starter", "growth", "enterprise"];

export class ProvisionTenantDto implements ProvisionTenantRequest {
  @ApiProperty({ example: "Riviera Pattaya Realty", minLength: 2 })
  @IsString()
  @MinLength(2)
  agencyName!: string;

  @ApiProperty({ example: "owner@riviera.example" })
  @IsEmail()
  workEmail!: string;

  @ApiProperty({ enum: subscriptionPlans, example: "starter" })
  @IsIn(subscriptionPlans)
  subscriptionPlan!: TenantSubscriptionPlan;

  @ApiPropertyOptional({ example: "https://riviera.example" })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  website?: string;
}
