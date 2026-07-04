import { Controller, Get, UseGuards } from "@nestjs/common";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { Tenant } from "../../../shared/presentation/tenant.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";

@Controller("tenants")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class CurrentTenantController {
  @Get("current")
  @Roles("agent", "broker", "manager", "admin")
  current(@Tenant() tenant: TenantSnapshot): TenantSnapshot {
    return tenant;
  }
}
