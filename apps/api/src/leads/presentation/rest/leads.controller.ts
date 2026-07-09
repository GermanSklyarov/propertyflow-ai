import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ApplyLeadQualityAssignResponse,
  ApplyLeadQualityContactResponse,
  ApplyLeadQualityFollowUpResponse,
  ApplyLeadQualityStatusResponse,
  LeadListResponse,
  LeadNotesResponse,
  LeadQualityAgentPerformanceResponse,
  LeadQualityActionsResponse,
  LeadQualitySignalsResponse,
  LeadQualitySourcePerformanceResponse,
  LeadQueueSummaryResponse,
  LeadSlaAgentPerformanceResponse,
  LeadSlaBreachesResponse,
  LeadSlaResponse,
  LeadSlaSourcePerformanceResponse,
  LeadSnapshot,
  LeadStatusHistoryResponse,
  LeadTimelineResponse,
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
import { ApplyLeadQualityAssignDto } from "./apply-lead-quality-assign.dto.js";
import { ApplyLeadQualityContactDto } from "./apply-lead-quality-contact.dto.js";
import { ApplyLeadQualityFollowUpDto } from "./apply-lead-quality-follow-up.dto.js";
import { ApplyLeadQualityStatusDto } from "./apply-lead-quality-status.dto.js";
import { AssignLeadDto } from "./assign-lead.dto.js";
import { CreateLeadDto } from "./create-lead.dto.js";
import { CreateLeadNoteDto } from "./create-lead-note.dto.js";
import { ListLeadsDto } from "./list-leads.dto.js";
import { UpdateLeadFollowUpDto } from "./update-lead-follow-up.dto.js";
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

  @Get()
  @Roles("agent", "broker", "manager", "admin")
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadListResponse> {
    return this.leads.list(tenantId, query, user);
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

  @Get("queue-summary")
  @Roles("agent", "broker", "manager", "admin")
  getQueueSummary(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadQueueSummaryResponse> {
    return this.leads.getQueueSummary(tenantId, query, user);
  }

  @Get("sla")
  @Roles("agent", "broker", "manager", "admin")
  getSlaSummary(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadSlaResponse> {
    return this.leads.getSlaSummary(tenantId, query, user);
  }

  @Get("sla/breaches")
  @Roles("agent", "broker", "manager", "admin")
  listSlaBreaches(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadSlaBreachesResponse> {
    return this.leads.listSlaBreaches(tenantId, query, user);
  }

  @Get("sla/agents")
  @Roles("agent", "broker", "manager", "admin")
  getSlaAgentPerformance(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadSlaAgentPerformanceResponse> {
    return this.leads.getSlaAgentPerformance(tenantId, query, user);
  }

  @Get("sla/sources")
  @Roles("agent", "broker", "manager", "admin")
  getSlaSourcePerformance(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadSlaSourcePerformanceResponse> {
    return this.leads.getSlaSourcePerformance(tenantId, query, user);
  }

  @Get("quality")
  @Roles("agent", "broker", "manager", "admin")
  getQualitySignals(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadQualitySignalsResponse> {
    return this.leads.getQualitySignals(tenantId, query, user);
  }

  @Get("quality/agents")
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              agentId: { type: "string", example: "agent-1" },
              total: { type: "number", example: 12 },
              affectedLeads: { type: "number", example: 5 },
              issueCount: { type: "number", example: 8 },
              missingContactInfo: { type: "number", example: 1 },
              missingProperty: { type: "number", example: 2 },
              missingFollowUp: { type: "number", example: 4 },
              staleNewLeads: { type: "number", example: 1 },
              affectedRate: { type: "number", example: 41.67 },
              healthScore: { type: "number", example: 58.33 },
              byIssue: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    bucket: { type: "string", example: "missing-follow-up" },
                    count: { type: "number", example: 4 }
                  },
                  required: ["bucket", "count"]
                }
              }
            },
            required: [
              "agentId",
              "total",
              "affectedLeads",
              "issueCount",
              "missingContactInfo",
              "missingProperty",
              "missingFollowUp",
              "staleNewLeads",
              "affectedRate",
              "healthScore",
              "byIssue"
            ]
          }
        },
        total: { type: "number", example: 3 },
        filters: { type: "object" },
        generatedAt: { type: "string", format: "date-time" }
      },
      required: ["items", "total", "filters", "generatedAt"]
    }
  })
  @Roles("agent", "broker", "manager", "admin")
  getQualityAgentPerformance(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadQualityAgentPerformanceResponse> {
    return this.leads.getQualityAgentPerformance(tenantId, query, user);
  }

  @Get("quality/sources")
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string", example: "ai-concierge" },
              total: { type: "number", example: 18 },
              affectedLeads: { type: "number", example: 7 },
              issueCount: { type: "number", example: 11 },
              missingContactInfo: { type: "number", example: 1 },
              missingProperty: { type: "number", example: 3 },
              unassigned: { type: "number", example: 2 },
              missingFollowUp: { type: "number", example: 4 },
              staleNewLeads: { type: "number", example: 1 },
              affectedRate: { type: "number", example: 38.89 },
              healthScore: { type: "number", example: 61.11 },
              byIssue: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    bucket: { type: "string", example: "missing-property" },
                    count: { type: "number", example: 3 }
                  },
                  required: ["bucket", "count"]
                }
              }
            },
            required: [
              "source",
              "total",
              "affectedLeads",
              "issueCount",
              "missingContactInfo",
              "missingProperty",
              "unassigned",
              "missingFollowUp",
              "staleNewLeads",
              "affectedRate",
              "healthScore",
              "byIssue"
            ]
          }
        },
        total: { type: "number", example: 4 },
        filters: { type: "object" },
        generatedAt: { type: "string", format: "date-time" }
      },
      required: ["items", "total", "filters", "generatedAt"]
    }
  })
  @Roles("agent", "broker", "manager", "admin")
  getQualitySourcePerformance(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadQualitySourcePerformanceResponse> {
    return this.leads.getQualitySourcePerformance(tenantId, query, user);
  }

  @Get("quality-actions")
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              lead: { type: "object" },
              issueTypes: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["missing-contact-info", "missing-property", "unassigned", "missing-follow-up", "stale-new-lead"]
                }
              },
              score: { type: "number", example: 7 },
              recommendedAction: {
                type: "string",
                enum: ["add-contact-info", "assign-agent", "update-status", "schedule-follow-up", "link-property"],
                example: "assign-agent"
              },
              recommendation: { type: "string", example: "Assign the lead to an agent so ownership is clear." }
            },
            required: ["lead", "issueTypes", "score", "recommendedAction", "recommendation"]
          }
        },
        total: { type: "number", example: 10 },
        filters: { type: "object" },
        generatedAt: { type: "string", format: "date-time" }
      },
      required: ["items", "total", "filters", "generatedAt"]
    }
  })
  @Roles("agent", "broker", "manager", "admin")
  listQualityActions(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListLeadsDto
  ): Promise<LeadQualityActionsResponse> {
    return this.leads.listQualityActions(tenantId, query, user);
  }

  @Post(":leadId/quality-actions/follow-up")
  @Roles("agent", "broker", "manager", "admin")
  applyQualityFollowUpAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: ApplyLeadQualityFollowUpDto
  ): Promise<ApplyLeadQualityFollowUpResponse> {
    return this.leads.applyQualityFollowUpAction(tenantId, leadId, payload, user);
  }

  @Post(":leadId/quality-actions/assign")
  @Roles("broker", "manager", "admin")
  applyQualityAssignAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: ApplyLeadQualityAssignDto
  ): Promise<ApplyLeadQualityAssignResponse> {
    return this.leads.applyQualityAssignAction(tenantId, leadId, payload, user);
  }

  @Post(":leadId/quality-actions/contact")
  @ApiBody({ type: ApplyLeadQualityContactDto })
  @ApiCreatedResponse({
    schema: {
      type: "object",
      properties: {
        lead: { type: "object" },
        note: { type: "object" }
      },
      required: ["lead"]
    }
  })
  @Roles("agent", "broker", "manager", "admin")
  applyQualityContactAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: ApplyLeadQualityContactDto
  ): Promise<ApplyLeadQualityContactResponse> {
    return this.leads.applyQualityContactAction(tenantId, leadId, payload, user);
  }

  @Post(":leadId/quality-actions/status")
  @Roles("agent", "broker", "manager", "admin")
  applyQualityStatusAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: ApplyLeadQualityStatusDto
  ): Promise<ApplyLeadQualityStatusResponse> {
    return this.leads.applyQualityStatusAction(tenantId, leadId, payload, user);
  }

  @Get(":leadId/status-history")
  @Roles("agent", "broker", "manager", "admin")
  getStatusHistory(
    @TenantId() tenantId: string,
    @Param("leadId") leadId: string
  ): Promise<LeadStatusHistoryResponse> {
    return this.leads.getStatusHistory(tenantId, leadId);
  }

  @Post(":leadId/notes")
  @Roles("agent", "broker", "manager", "admin")
  createNote(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: CreateLeadNoteDto
  ): Promise<LeadNotesResponse["items"][number]> {
    return this.leads.createNote(tenantId, leadId, payload, user);
  }

  @Get(":leadId/notes")
  @Roles("agent", "broker", "manager", "admin")
  listNotes(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string
  ): Promise<LeadNotesResponse> {
    return this.leads.listNotes(tenantId, leadId, user);
  }

  @Get(":leadId/timeline")
  @Roles("agent", "broker", "manager", "admin")
  getTimeline(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string
  ): Promise<LeadTimelineResponse> {
    return this.leads.getTimeline(tenantId, leadId, user);
  }

  @Patch(":leadId/follow-up")
  @Roles("agent", "broker", "manager", "admin")
  updateFollowUp(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() payload: UpdateLeadFollowUpDto
  ): Promise<LeadSnapshot> {
    return this.leads.updateFollowUp(tenantId, leadId, payload, user);
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
