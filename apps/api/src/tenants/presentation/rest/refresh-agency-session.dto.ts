import { IsString } from "class-validator";
import type { RefreshAgencySessionRequest } from "@propertyflow/contracts";

export class RefreshAgencySessionDto implements RefreshAgencySessionRequest {
  @IsString()
  refreshToken!: string;

  @IsString()
  tenantId!: string;
}
