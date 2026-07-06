import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { AuditEventListResponse } from "@propertyflow/contracts";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { AuditService } from "../../application/audit.service.js";
import { ListAuditEventsDto, toListAuditEventsQuery } from "./list-audit-events.dto.js";

@ApiTags("audit")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("audit/events")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class AuditEventsController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @Roles("manager", "admin")
  list(@TenantId() tenantId: string, @Query() query: ListAuditEventsDto): Promise<AuditEventListResponse> {
    return this.audit.list(tenantId, toListAuditEventsQuery(query));
  }
}
