import type { CreateLeadRequest, LeadSnapshot, LeadStatus } from "@propertyflow/contracts";

export const LEAD_REPOSITORY = Symbol("LEAD_REPOSITORY");

export interface CreateLeadInput extends CreateLeadRequest {
  tenantId: string;
}

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<LeadSnapshot>;
  findById(tenantId: string, leadId: string): Promise<LeadSnapshot | null>;
  listUnassigned(tenantId: string): Promise<LeadSnapshot[]>;
  listByAttribution(tenantId: string, attributionSearchEventId: string): Promise<LeadSnapshot[]>;
  assign(tenantId: string, leadId: string, assignedAgentId: string): Promise<LeadSnapshot | null>;
  updateStatus(tenantId: string, leadId: string, status: LeadStatus): Promise<LeadSnapshot | null>;
}
