import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateLeadRequest,
  LeadListResponse,
  LeadSnapshot,
  LeadStatus,
  RequestUser,
  SavedSearchLeadAnalyticsResponse
} from "@propertyflow/contracts";
import { AuditService } from "../../audit/application/audit.service.js";
import { RealtimePublisherService } from "../../realtime/application/realtime-publisher.service.js";
import { UserService } from "../../users/application/user.service.js";
import { LEAD_REPOSITORY, type LeadRepository } from "../domain/lead.repository.js";

@Injectable()
export class LeadService {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(RealtimePublisherService) private readonly realtime: RealtimePublisherService
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

    this.realtime.publish(tenantId, "lead.created", {
      leadId: lead.id,
      propertyId: lead.propertyId,
      source: lead.source,
      assignedAgentId: lead.assignedAgentId
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

  async listByAttribution(tenantId: string, attributionSearchEventId: string): Promise<LeadListResponse> {
    const items = await this.leads.listByAttribution(tenantId, attributionSearchEventId);

    return {
      items,
      total: items.length
    };
  }

  async getAttributionAnalytics(
    tenantId: string,
    attributionSearchEventId: string
  ): Promise<SavedSearchLeadAnalyticsResponse> {
    const items = await this.leads.listByAttribution(tenantId, attributionSearchEventId);
    const statuses: LeadStatus[] = ["new", "contacted", "qualified", "lost", "won"];

    return {
      savedSearchId: attributionSearchEventId,
      totalLeads: items.length,
      leadsByStatus: statuses.map((status) => ({
        status,
        count: items.filter((lead) => lead.status === status).length
      })),
      latestLead: items[0],
      generatedAt: new Date().toISOString()
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

    this.realtime.publish(tenantId, "lead.assigned", {
      leadId: lead.id,
      assignedAgentId,
      status: lead.status
    });

    return lead;
  }
}
