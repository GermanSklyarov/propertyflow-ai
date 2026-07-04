import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateLeadRequest, LeadListResponse, LeadSnapshot, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../audit/application/audit.service.js";
import { UserService } from "../../users/application/user.service.js";
import { LEAD_REPOSITORY, type LeadRepository } from "../domain/lead.repository.js";

@Injectable()
export class LeadService {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UserService) private readonly users: UserService
  ) {}

  async create(tenantId: string, request: CreateLeadRequest, user?: RequestUser): Promise<LeadSnapshot> {
    const lead = await this.leads.create({
      ...request,
      tenantId
    });

    await this.audit.record({
      tenantId,
      user,
      action: "lead.created",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: {
        propertyId: lead.propertyId,
        source: lead.source,
        assignedAgentId: lead.assignedAgentId
      }
    });

    return lead;
  }

  async listUnassigned(tenantId: string): Promise<LeadListResponse> {
    const items = await this.leads.listUnassigned(tenantId);

    return {
      items,
      total: items.length
    };
  }

  async assign(tenantId: string, leadId: string, assignedAgentId: string, user: RequestUser): Promise<LeadSnapshot> {
    await this.users.getActiveAssignableUser(tenantId, assignedAgentId);

    const lead = await this.leads.assign(tenantId, leadId, assignedAgentId);

    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    await this.audit.record({
      tenantId,
      user,
      action: "lead.assigned",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: {
        assignedAgentId
      }
    });

    return lead;
  }
}
