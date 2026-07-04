import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { LeadSnapshot, RequestUser } from "@propertyflow/contracts";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { LeadService } from "../../application/lead.service.js";
import { CreateLeadDto } from "./create-lead.dto.js";

@ApiTags("leads")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("leads")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leads: LeadService) {}

  @Post()
  @Roles("agent", "broker", "manager", "admin")
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateLeadDto
  ): Promise<LeadSnapshot> {
    return this.leads.create(tenantId, payload, user);
  }
}

