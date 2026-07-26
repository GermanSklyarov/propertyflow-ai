import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  CreateAgencySessionResponse,
  ProvisionTenantResponse,
  RefreshAgencySessionResponse
} from "@propertyflow/contracts";
import { TenantService } from "../../application/tenant.service.js";
import { CreateAgencySessionDto } from "./create-agency-session.dto.js";
import { ProvisionTenantDto } from "./provision-tenant.dto.js";
import { RefreshAgencySessionDto } from "./refresh-agency-session.dto.js";

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

  @Post("session/refresh")
  @ApiOperation({ summary: "Rotate an agency refresh token and issue a fresh access token" })
  @ApiCreatedResponse({ description: "Agency session was refreshed" })
  refreshSession(@Body() payload: RefreshAgencySessionDto): Promise<RefreshAgencySessionResponse> {
    return this.tenants.refreshAgencySession(payload);
  }
}
