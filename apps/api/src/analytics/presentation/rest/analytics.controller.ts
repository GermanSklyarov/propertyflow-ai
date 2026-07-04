import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { TenantDashboardMetrics } from "@propertyflow/contracts";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { AnalyticsService } from "../../application/analytics.service.js";

@ApiTags("analytics")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("analytics")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get("dashboard")
  @Roles("broker", "manager", "admin")
  dashboard(@TenantId() tenantId: string): Promise<TenantDashboardMetrics> {
    return this.analytics.getDashboard(tenantId);
  }
}
