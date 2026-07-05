import { Injectable } from "@nestjs/common";
import type { PropertyStatusEventSnapshot } from "@propertyflow/contracts";
import type {
  PropertyStatusHistoryRepository,
  RecordPropertyStatusEventInput
} from "../domain/property-status-history.repository.js";

@Injectable()
export class InMemoryPropertyStatusHistoryRepository implements PropertyStatusHistoryRepository {
  private readonly events = new Map<string, PropertyStatusEventSnapshot[]>();

  async record(input: RecordPropertyStatusEventInput): Promise<PropertyStatusEventSnapshot> {
    const event: PropertyStatusEventSnapshot = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      previousStatus: input.previousStatus,
      status: input.status,
      changedByUserId: input.user.id,
      changedByUserRole: input.user.role,
      note: input.note,
      createdAt: new Date().toISOString()
    };
    const key = this.key(input.tenantId, input.propertyId);
    const existing = this.events.get(key) ?? [];

    this.events.set(key, [...existing, event]);

    return event;
  }

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyStatusEventSnapshot[]> {
    return this.events.get(this.key(tenantId, propertyId)) ?? [];
  }

  private key(tenantId: string, propertyId: string): string {
    return `${tenantId}:${propertyId}`;
  }
}
