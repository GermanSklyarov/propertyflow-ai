import type { AuditEventSnapshot } from "@propertyflow/contracts";

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
  record(input: RecordAuditEventInput): Promise<AuditEventSnapshot>;
}

