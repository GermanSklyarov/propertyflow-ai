import { Inject, Injectable } from "@nestjs/common";
import type { AuditEventListResponse, AuditEventSnapshot, ListAuditEventsRequest, RequestUser } from "@propertyflow/contracts";
import { AUDIT_REPOSITORY, type AuditRepository, type RecordAuditEventInput } from "../domain/audit.repository.js";

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly auditEvents: AuditRepository) {}

  async list(tenantId: string, request: ListAuditEventsRequest): Promise<AuditEventListResponse> {
    const items = await this.auditEvents.list(tenantId, request);

    return {
      items,
      total: items.length,
      filters: request
    };
  }

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
