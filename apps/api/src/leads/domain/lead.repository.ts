import type {
  CreateLeadRequest,
  LeadNoteSnapshot,
  LeadSnapshot,
  LeadStatus,
  LeadStatusEventSnapshot,
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

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<LeadSnapshot>;
  findById(tenantId: string, leadId: string): Promise<LeadSnapshot | null>;
  createNote(input: CreateLeadNoteInput): Promise<LeadNoteSnapshot>;
  listNotes(tenantId: string, leadId: string): Promise<LeadNoteSnapshot[]>;
  recordStatusEvent(input: RecordLeadStatusEventInput): Promise<LeadStatusEventSnapshot>;
  listStatusEvents(tenantId: string, leadId: string): Promise<LeadStatusEventSnapshot[]>;
  list(tenantId: string, request?: ListLeadsRequest): Promise<LeadSnapshot[]>;
  listUnassigned(tenantId: string): Promise<LeadSnapshot[]>;
  listByAttribution(tenantId: string, attributionSearchEventId: string): Promise<LeadSnapshot[]>;
  assign(tenantId: string, leadId: string, assignedAgentId: string): Promise<LeadSnapshot | null>;
  updateStatus(tenantId: string, leadId: string, status: LeadStatus): Promise<LeadSnapshot | null>;
}
