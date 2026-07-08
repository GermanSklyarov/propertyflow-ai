import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ApplyLeadQualityFollowUpRequest,
  ApplyLeadQualityFollowUpResponse,
  CreateLeadNoteRequest,
  CreateLeadRequest,
  LeadListResponse,
  LeadNotesResponse,
  LeadQualityActionsResponse,
  LeadQualitySignalsResponse,
  LeadQueueSummaryResponse,
  LeadSnapshot,
  LeadStatus,
  LeadStatusHistoryResponse,
  LeadTimelineResponse,
  ListLeadsRequest,
  RequestUser,
  SavedSearchLeadAnalyticsResponse,
  UpdateLeadFollowUpRequest
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

  async list(tenantId: string, request: ListLeadsRequest, user: RequestUser): Promise<LeadListResponse> {
    const scopedRequest = this.scopeLeadQueueRequest(request, user);
    const items = await this.leads.list(tenantId, scopedRequest);

    return {
      items,
      total: items.length
    };
  }

  async getQueueSummary(
    tenantId: string,
    request: ListLeadsRequest,
    user: RequestUser
  ): Promise<LeadQueueSummaryResponse> {
    const scopedRequest = this.scopeLeadQueueRequest(request, user);
    const summary = await this.leads.getQueueSummary(tenantId, scopedRequest);

    return {
      ...summary,
      filters: scopedRequest,
      generatedAt: new Date().toISOString()
    };
  }

  async getQualitySignals(
    tenantId: string,
    request: ListLeadsRequest,
    user: RequestUser
  ): Promise<LeadQualitySignalsResponse> {
    const scopedRequest = this.scopeLeadQueueRequest(request, user);
    const signals = await this.leads.getQualitySignals(tenantId, scopedRequest);

    return {
      ...signals,
      filters: scopedRequest,
      generatedAt: new Date().toISOString()
    };
  }

  async listQualityActions(
    tenantId: string,
    request: ListLeadsRequest,
    user: RequestUser
  ): Promise<LeadQualityActionsResponse> {
    const scopedRequest = this.scopeLeadQueueRequest(request, user);
    const items = await this.leads.listQualityActions(tenantId, scopedRequest);

    return {
      items,
      total: items.length,
      filters: scopedRequest,
      generatedAt: new Date().toISOString()
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

  async createNote(
    tenantId: string,
    leadId: string,
    request: CreateLeadNoteRequest,
    user: RequestUser
  ): Promise<LeadNotesResponse["items"][number]> {
    const lead = await this.getVisibleLead(tenantId, leadId, user);
    const noteText = request.note.trim();

    if (noteText.length < 2) {
      throw new BadRequestException("Lead note must contain at least 2 non-whitespace characters");
    }

    const note = await this.leads.createNote({
      tenantId,
      leadId,
      note: noteText,
      user
    });

    await this.audit.record({
      tenantId,
      user,
      action: "lead.note_added",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: {
        propertyId: lead.propertyId,
        assignedAgentId: lead.assignedAgentId
      }
    });

    this.realtime.publish(tenantId, "lead.note_added", {
      leadId: lead.id,
      noteId: note.id,
      propertyId: lead.propertyId,
      assignedAgentId: lead.assignedAgentId
    });

    return note;
  }

  async listNotes(tenantId: string, leadId: string, user: RequestUser): Promise<LeadNotesResponse> {
    await this.getVisibleLead(tenantId, leadId, user);
    const items = await this.leads.listNotes(tenantId, leadId);

    return {
      leadId,
      items,
      total: items.length
    };
  }

  async getTimeline(tenantId: string, leadId: string, user: RequestUser): Promise<LeadTimelineResponse> {
    await this.getVisibleLead(tenantId, leadId, user);
    const items = await this.leads.listTimeline(tenantId, leadId);

    return {
      leadId,
      items,
      total: items.length
    };
  }

  async updateFollowUp(
    tenantId: string,
    leadId: string,
    request: UpdateLeadFollowUpRequest,
    user: RequestUser
  ): Promise<LeadSnapshot> {
    const currentLead = await this.getVisibleLead(tenantId, leadId, user);

    if (request.priority === undefined && request.nextFollowUpAt === undefined) {
      throw new BadRequestException("Provide priority or nextFollowUpAt");
    }

    const lead = await this.leads.updateFollowUp(tenantId, leadId, {
      priority: request.priority,
      nextFollowUpAt: request.nextFollowUpAt
    });

    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    await this.audit.record({
      tenantId,
      user,
      action: "lead.follow_up_updated",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: {
        previousPriority: currentLead.priority,
        priority: lead.priority,
        previousNextFollowUpAt: currentLead.nextFollowUpAt,
        nextFollowUpAt: lead.nextFollowUpAt,
        assignedAgentId: lead.assignedAgentId
      }
    });

    this.realtime.publish(tenantId, "lead.follow_up_updated", {
      leadId: lead.id,
      priority: lead.priority,
      nextFollowUpAt: lead.nextFollowUpAt,
      assignedAgentId: lead.assignedAgentId
    });

    return lead;
  }

  async applyQualityFollowUpAction(
    tenantId: string,
    leadId: string,
    request: ApplyLeadQualityFollowUpRequest,
    user: RequestUser
  ): Promise<ApplyLeadQualityFollowUpResponse> {
    const lead = await this.updateFollowUp(
      tenantId,
      leadId,
      {
        nextFollowUpAt: request.nextFollowUpAt,
        priority: request.priority
      },
      user
    );
    const noteText = request.note?.trim();
    const note =
      noteText && noteText.length > 0 ? await this.createNote(tenantId, leadId, { note: noteText }, user) : undefined;

    return {
      lead,
      note
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

  private async getVisibleLead(tenantId: string, leadId: string, user: RequestUser): Promise<LeadSnapshot> {
    const lead = await this.leads.findById(tenantId, leadId);

    if (!lead || (user.role === "agent" && lead.assignedAgentId !== user.id)) {
      throw new NotFoundException("Lead not found");
    }

    return lead;
  }

  private scopeLeadQueueRequest(request: ListLeadsRequest, user: RequestUser): ListLeadsRequest {
    if (user.role !== "agent") {
      return request;
    }

    return {
      ...request,
      assignedAgentId: user.id,
      unassigned: false
    };
  }
}
