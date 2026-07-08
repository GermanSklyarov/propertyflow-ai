import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateLeadRequest,
  LeadListResponse,
  LeadSnapshot,
  LeadStatus,
  LeadStatusHistoryResponse,
  RequestUser,
  SavedSearchLeadAnalyticsResponse
} from "@propertyflow/contracts";
import { AuditService } from "../../audit/application/audit.service.js";
import { RealtimePublisherService } from "../../realtime/application/realtime-publisher.service.js";
import { UserService } from "../../users/application/user.service.js";
import { LEAD_REPOSITORY, type LeadRepository } from "../domain/lead.repository.js";

@Injectable()
export class LeadService {
  private readonly statusTransitions: Record<LeadStatus, LeadStatus[]> = {
    new: ["contacted", "qualified", "lost"],
    contacted: ["qualified", "lost"],
    qualified: ["won", "lost"],
    lost: [],
    won: []
  };

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

    await this.leads.recordStatusEvent({
      tenantId,
      leadId: lead.id,
      status: lead.status,
      user
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

  async getStatusHistory(tenantId: string, leadId: string): Promise<LeadStatusHistoryResponse> {
    const lead = await this.leads.findById(tenantId, leadId);

    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    const items = await this.leads.listStatusEvents(tenantId, leadId);

    return {
      leadId,
      items,
      total: items.length
    };
  }

  async updateStatus(tenantId: string, leadId: string, status: LeadStatus, user: RequestUser): Promise<LeadSnapshot> {
    const currentLead = await this.leads.findById(tenantId, leadId);

    if (!currentLead) {
      throw new NotFoundException("Lead not found");
    }

    if (currentLead.status === status) {
      return currentLead;
    }

    if (!this.statusTransitions[currentLead.status].includes(status)) {
      throw new BadRequestException(`Cannot move lead from ${currentLead.status} to ${status}`);
    }

    const lead = await this.leads.updateStatus(tenantId, leadId, status);

    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    await this.audit.record({
      tenantId,
      user,
      action: "lead.status_changed",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: {
        previousStatus: currentLead.status,
        status,
        propertyId: lead.propertyId,
        source: lead.source,
        assignedAgentId: lead.assignedAgentId
      }
    });

    this.realtime.publish(tenantId, "lead.status_changed", {
      leadId: lead.id,
      previousStatus: currentLead.status,
      status: lead.status,
      propertyId: lead.propertyId,
      assignedAgentId: lead.assignedAgentId
    });

    await this.leads.recordStatusEvent({
      tenantId,
      leadId: lead.id,
      previousStatus: currentLead.status,
      status: lead.status,
      user
    });

    return lead;
  }
}
