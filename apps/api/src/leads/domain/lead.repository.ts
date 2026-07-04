import type { CreateLeadRequest, LeadSnapshot } from "@propertyflow/contracts";

export const LEAD_REPOSITORY = Symbol("LEAD_REPOSITORY");

export interface CreateLeadInput extends CreateLeadRequest {
  tenantId: string;
}

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<LeadSnapshot>;
}

