import type { AuditEventSnapshot, ListAuditEventsRequest } from "@propertyflow/contracts";

export const AUDIT_REPOSITORY = Symbol("AUDIT_REPOSITORY");

export interface RecordAuditEventInput {
  tenantId: string;
  userId?: string;
  userRole?: AuditEventSnapshot["userRole"];
  action: AuditEventSnapshot["action"];
  resourceType: AuditEventSnapshot["resourceType"];
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRepository {
  list(tenantId: string, request: ListAuditEventsRequest): Promise<AuditEventSnapshot[]>;
  record(input: RecordAuditEventInput): Promise<AuditEventSnapshot>;
}
