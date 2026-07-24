import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ProvisionTenantResponse } from "@propertyflow/contracts";
import { TenantService } from "../../application/tenant.service.js";
import { ProvisionTenantDto } from "./provision-tenant.dto.js";

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
}
