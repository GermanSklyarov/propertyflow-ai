import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  LeadListResponse,
  LeadSnapshot,
  LeadStatusHistoryResponse,
  RequestUser,
  TenantUserSnapshot
} from "@propertyflow/contracts";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { UserService } from "../../../users/application/user.service.js";
import { LeadService } from "../../application/lead.service.js";
import { AssignLeadDto } from "./assign-lead.dto.js";
import { CreateLeadDto } from "./create-lead.dto.js";
import { UpdateLeadStatusDto } from "./update-lead-status.dto.js";

@ApiTags("leads")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("leads")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class LeadsController {
  constructor(
    @Inject(LeadService) private readonly leads: LeadService,
    @Inject(UserService) private readonly users: UserService
  ) {}

  @Post()
  @Roles("agent", "broker", "manager", "admin")
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateLeadDto
  ): Promise<LeadSnapshot> {
    return this.leads.create(tenantId, payload, user);
  }

  @Get("unassigned")
  @Roles("broker", "manager", "admin")
  listUnassigned(@TenantId() tenantId: string): Promise<LeadListResponse> {
    return this.leads.listUnassigned(tenantId);
  }

  @Get("agents")
  @Roles("broker", "manager", "admin")
  listAgents(@TenantId() tenantId: string): Promise<TenantUserSnapshot[]> {
    return this.users.listAgents(tenantId);
  }

  @Get(":leadId/status-history")
  @Roles("agent", "broker", "manager", "admin")
  getStatusHistory(
    @TenantId() tenantId: string,
    @Param("leadId") leadId: string
  ): Promise<LeadStatusHistoryResponse> {
    return this.leads.getStatusHistory(tenantId, leadId);
  }

  @Patch(":leadId/assign")
  @Roles("broker", "manager", "admin")
  assign(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: AssignLeadDto
  ): Promise<LeadSnapshot> {
    return this.leads.assign(tenantId, leadId, payload.assignedAgentId, user);
  }

  @Patch(":leadId/status")
  @Roles("agent", "broker", "manager", "admin")
  updateStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: UpdateLeadStatusDto
  ): Promise<LeadSnapshot> {
    return this.leads.updateStatus(tenantId, leadId, payload.status, user);
  }
}
