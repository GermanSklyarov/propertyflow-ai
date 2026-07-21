import { ApiProperty } from "@nestjs/swagger";
import { IsUrl } from "class-validator";
import type { TenantWidgetInstallCheckRequest } from "@propertyflow/contracts";

export class TenantWidgetInstallCheckDto implements TenantWidgetInstallCheckRequest {
  @ApiProperty({ example: "https://agency.example.com/listings/wongamat-condo" })
  @IsUrl({ require_tld: false, require_protocol: true })
  url!: string;
}
