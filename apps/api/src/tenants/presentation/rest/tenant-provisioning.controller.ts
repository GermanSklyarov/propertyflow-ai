import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  CreateAgencySessionResponse,
  LogoutAgencySessionResponse,
  ProvisionTenantResponse,
  RefreshAgencySessionResponse,
  RequestAgencyMagicLinkResponse
} from "@propertyflow/contracts";
import { TenantService } from "../../application/tenant.service.js";
import { CreateAgencySessionDto } from "./create-agency-session.dto.js";
import { ExchangeAgencyMagicLinkDto } from "./exchange-agency-magic-link.dto.js";
import { LogoutAgencySessionDto } from "./logout-agency-session.dto.js";
import { ProvisionTenantDto } from "./provision-tenant.dto.js";
import { RefreshAgencySessionDto } from "./refresh-agency-session.dto.js";
import { RequestAgencyMagicLinkDto } from "./request-agency-magic-link.dto.js";

@Controller("tenants")
@ApiTags("tenants")
export class TenantProvisioningController {
  constructor(@Inject(TenantService) private readonly tenants: TenantService) {}

  @Post("provision")
  @ApiOperation({ summary: "Provision a new agency workspace from the plan signup flow" })
  @ApiCreatedResponse({ description: "Agency tenant workspace was created" })
  provision(@Body() payload: ProvisionTenantDto): Promise<ProvisionTenantResponse> {
    return this.tenants.provision(payload);
  }

  @Post("session")
  @ApiOperation({ summary: "Create an agency workspace session after signup or bootstrap login" })
  @ApiCreatedResponse({ description: "Agency session was created" })
  createSession(@Body() payload: CreateAgencySessionDto): Promise<CreateAgencySessionResponse> {
    return this.tenants.createAgencySession(payload);
  }

  @Post("session/magic-link")
  @ApiOperation({ summary: "Request a one-time agency sign-in link for a workspace user" })
  @ApiCreatedResponse({ description: "Magic-link request was accepted" })
  requestMagicLink(@Body() payload: RequestAgencyMagicLinkDto): Promise<RequestAgencyMagicLinkResponse> {
    return this.tenants.requestAgencyMagicLink(payload);
  }

  @Post("session/magic-link/exchange")
  @ApiOperation({ summary: "Exchange a one-time agency magic link for an access and refresh session" })
  @ApiCreatedResponse({ description: "Agency session was created from a magic link" })
  exchangeMagicLink(@Body() payload: ExchangeAgencyMagicLinkDto): Promise<CreateAgencySessionResponse> {
    return this.tenants.exchangeAgencyMagicLink(payload);
  }

  @Post("session/refresh")
  @ApiOperation({ summary: "Rotate an agency refresh token and issue a fresh access token" })
  @ApiCreatedResponse({ description: "Agency session was refreshed" })
  refreshSession(@Body() payload: RefreshAgencySessionDto): Promise<RefreshAgencySessionResponse> {
    return this.tenants.refreshAgencySession(payload);
  }

  @Post("session/logout")
  @ApiOperation({ summary: "Revoke an agency refresh token and end the browser session" })
  @ApiCreatedResponse({ description: "Agency session was revoked" })
  logoutSession(@Body() payload: LogoutAgencySessionDto): Promise<LogoutAgencySessionResponse> {
    return this.tenants.logoutAgencySession(payload);
  }
}
