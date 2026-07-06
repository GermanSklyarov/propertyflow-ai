import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { AcknowledgeSecurityEventResponse, RequestUser, TenantDashboardMetrics, TenantSecurityEventsResponse } from "@propertyflow/contracts";
import { RealtimePublisherService } from "../../../realtime/application/realtime-publisher.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { AnalyticsService } from "../../application/analytics.service.js";
import { AcknowledgeSecurityEventDto } from "./acknowledge-security-event.dto.js";
import { ListSecurityEventsDto } from "./list-security-events.dto.js";

@ApiTags("analytics")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("analytics")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(RealtimePublisherService) private readonly realtime: RealtimePublisherService
  ) {}

  @Get("dashboard")
  @Roles("broker", "manager", "admin")
  dashboard(@TenantId() tenantId: string): Promise<TenantDashboardMetrics> {
    return this.analytics.getDashboard(tenantId);
  }

  @Get("security-events")
  @Roles("manager", "admin")
  securityEvents(
    @TenantId() tenantId: string,
    @Query() query: ListSecurityEventsDto
  ): Promise<TenantSecurityEventsResponse> {
    return this.analytics.listSecurityEvents(tenantId, query);
  }

  @Post("security-events/:eventId/acknowledge")
  @Roles("manager", "admin")
  async acknowledgeSecurityEvent(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("eventId") eventId: string,
    @Body() payload: AcknowledgeSecurityEventDto
  ): Promise<AcknowledgeSecurityEventResponse> {
    const result = await this.analytics.acknowledgeSecurityEvent(tenantId, eventId, payload, user);

    this.realtime.publish(tenantId, "security.event_acknowledged", {
      eventId: result.event.id,
      kind: result.event.kind,
      severity: result.event.severity,
      acknowledgedAt: result.event.acknowledgedAt,
      acknowledgedByUserId: result.event.acknowledgedByUserId,
      acknowledgedByUserRole: result.event.acknowledgedByUserRole,
      note: result.event.acknowledgementNote
    });

    return result;
  }
}
