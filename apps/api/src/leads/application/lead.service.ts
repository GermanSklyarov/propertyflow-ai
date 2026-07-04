import { Inject, Injectable } from "@nestjs/common";
import type { CreateLeadRequest, LeadSnapshot, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../audit/application/audit.service.js";
import { LEAD_REPOSITORY, type LeadRepository } from "../domain/lead.repository.js";

@Injectable()
export class LeadService {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(AuditService) private readonly audit: AuditService
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
}

