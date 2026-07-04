import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { RequestUser, TenantSnapshot } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { Tenant } from "../../../shared/presentation/tenant.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";

@Controller("tenants")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class CurrentTenantController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get("current")
  @Roles("agent", "broker", "manager", "admin")
  async current(@Tenant() tenant: TenantSnapshot, @CurrentUser() user: RequestUser): Promise<TenantSnapshot> {
    await this.audit.record({
      tenantId: tenant.id,
      user,
      action: "tenant.current_viewed",
      resourceType: "tenant",
      resourceId: tenant.id,
      metadata: {
        slug: tenant.slug,
        status: tenant.status
      }
    });

    return tenant;
  }
}
