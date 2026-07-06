import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { RequestUser, TenantSnapshot, TenantUsageResponse } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { Tenant } from "../../../shared/presentation/tenant.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { TenantService } from "../../application/tenant.service.js";
import { UpdateTenantSettingsDto } from "./update-tenant-settings.dto.js";

@Controller("tenants")
@ApiTags("tenants")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class CurrentTenantController {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TenantService) private readonly tenants: TenantService
  ) {}

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

  @Get("current/usage")
  @Roles("broker", "manager", "admin")
  usage(@Tenant() tenant: TenantSnapshot): Promise<TenantUsageResponse> {
    return this.tenants.getUsage(tenant.id);
  }

  @Patch("current/settings")
  @Roles("manager", "admin")
  async updateSettings(
    @Tenant() tenant: TenantSnapshot,
    @CurrentUser() user: RequestUser,
    @Body() payload: UpdateTenantSettingsDto
  ): Promise<TenantSnapshot> {
    const updated = await this.tenants.updateSettings(tenant.id, payload);

    await this.audit.record({
      tenantId: tenant.id,
      user,
      action: "tenant.settings_updated",
      resourceType: "tenant",
      resourceId: tenant.id,
      metadata: {
        primaryMarket: updated.primaryMarket,
        customDomain: updated.customDomain,
        domainStatus: updated.domainStatus,
        branding: updated.branding
      }
    });

    return updated;
  }
}
