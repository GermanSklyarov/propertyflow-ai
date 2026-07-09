import type {
  CreateLeadRequest,
  LeadNoteSnapshot,
  LeadConversionAgentPerformanceResponse,
  LeadConversionSourcePerformanceResponse,
  LeadQualityAgentPerformanceResponse,
  LeadQualityActionsResponse,
  LeadPriority,
  LeadQualitySignalsResponse,
  LeadQualitySourcePerformanceResponse,
  LeadQueueSummaryResponse,
  LeadSlaAgentPerformanceResponse,
  LeadSlaBreachesResponse,
  LeadSlaResponse,
  LeadSlaSourcePerformanceResponse,
  LeadSnapshot,
  LeadStatus,
  LeadStatusEventSnapshot,
  LeadTimelineEventSnapshot,
  ListLeadsRequest,
  RequestUser
} from "@propertyflow/contracts";

export const LEAD_REPOSITORY = Symbol("LEAD_REPOSITORY");

export interface CreateLeadInput extends CreateLeadRequest {
  tenantId: string;
}

export interface RecordLeadStatusEventInput {
  tenantId: string;
  leadId: string;
  previousStatus?: LeadStatus;
  status: LeadStatus;
  user?: RequestUser;
}

export interface CreateLeadNoteInput {
  tenantId: string;
  leadId: string;
  note: string;
  user: RequestUser;
}

export interface UpdateLeadFollowUpInput {
  priority?: LeadPriority;
  nextFollowUpAt?: string | null;
}

export interface UpdateLeadContactInput {
  contactEmail?: string;
  contactPhone?: string;
}

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<LeadSnapshot>;
  findById(tenantId: string, leadId: string): Promise<LeadSnapshot | null>;
  createNote(input: CreateLeadNoteInput): Promise<LeadNoteSnapshot>;
  listNotes(tenantId: string, leadId: string): Promise<LeadNoteSnapshot[]>;
  listTimeline(tenantId: string, leadId: string): Promise<LeadTimelineEventSnapshot[]>;
  recordStatusEvent(input: RecordLeadStatusEventInput): Promise<LeadStatusEventSnapshot>;
  listStatusEvents(tenantId: string, leadId: string): Promise<LeadStatusEventSnapshot[]>;
  list(tenantId: string, request?: ListLeadsRequest): Promise<LeadSnapshot[]>;
  getQueueSummary(tenantId: string, request?: ListLeadsRequest): Promise<Omit<LeadQueueSummaryResponse, "filters" | "generatedAt">>;
  getSlaSummary(tenantId: string, request?: ListLeadsRequest): Promise<Omit<LeadSlaResponse, "filters" | "generatedAt">>;
  listSlaBreaches(tenantId: string, request?: ListLeadsRequest): Promise<LeadSlaBreachesResponse["items"]>;
  getSlaAgentPerformance(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<LeadSlaAgentPerformanceResponse["items"]>;
  getSlaSourcePerformance(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<LeadSlaSourcePerformanceResponse["items"]>;
  getConversionAgentPerformance(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<LeadConversionAgentPerformanceResponse["items"]>;
  getConversionSourcePerformance(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<LeadConversionSourcePerformanceResponse["items"]>;
  getQualitySignals(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<Omit<LeadQualitySignalsResponse, "filters" | "generatedAt">>;
  getQualityAgentPerformance(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<LeadQualityAgentPerformanceResponse["items"]>;
  getQualitySourcePerformance(
    tenantId: string,
    request?: ListLeadsRequest
  ): Promise<LeadQualitySourcePerformanceResponse["items"]>;
  listQualityActions(tenantId: string, request?: ListLeadsRequest): Promise<LeadQualityActionsResponse["items"]>;
  listUnassigned(tenantId: string): Promise<LeadSnapshot[]>;
  listByAttribution(tenantId: string, attributionSearchEventId: string): Promise<LeadSnapshot[]>;
  assign(tenantId: string, leadId: string, assignedAgentId: string): Promise<LeadSnapshot | null>;
  updateContact(tenantId: string, leadId: string, input: UpdateLeadContactInput): Promise<LeadSnapshot | null>;
  updateProperty(tenantId: string, leadId: string, propertyId: string): Promise<LeadSnapshot | null>;
  updateFollowUp(tenantId: string, leadId: string, input: UpdateLeadFollowUpInput): Promise<LeadSnapshot | null>;
  updateStatus(tenantId: string, leadId: string, status: LeadStatus): Promise<LeadSnapshot | null>;
}
