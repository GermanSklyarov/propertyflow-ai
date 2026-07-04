import { Inject, Injectable } from "@nestjs/common";
import type { AuditEventSnapshot, RequestUser } from "@propertyflow/contracts";
import { AUDIT_REPOSITORY, type AuditRepository, type RecordAuditEventInput } from "../domain/audit.repository.js";

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly auditEvents: AuditRepository) {}

  async record(input: RecordAuditEventInput & { user?: RequestUser }): Promise<AuditEventSnapshot> {
    return this.auditEvents.record({
      tenantId: input.tenantId,
      userId: input.user?.id ?? input.userId,
      userRole: input.user?.role ?? input.userRole,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata
    });
  }
}

