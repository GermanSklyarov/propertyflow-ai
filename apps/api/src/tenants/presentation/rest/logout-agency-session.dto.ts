import { IsString } from "class-validator";
import type { LogoutAgencySessionRequest } from "@propertyflow/contracts";

export class LogoutAgencySessionDto implements LogoutAgencySessionRequest {
  @IsString()
  refreshToken!: string;

  @IsString()
  tenantId!: string;
}
