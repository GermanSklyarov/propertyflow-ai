import { Controller, Get, UseGuards } from "@nestjs/common";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { Tenant } from "../../../shared/presentation/tenant.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";

@Controller("tenants")
@UseGuards(TenantGuard)
export class CurrentTenantController {
  @Get("current")
  current(@Tenant() tenant: TenantSnapshot): TenantSnapshot {
    return tenant;
  }
}
