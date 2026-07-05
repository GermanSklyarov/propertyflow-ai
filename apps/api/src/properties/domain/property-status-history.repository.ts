import type { PropertyStatusEventSnapshot, RequestUser } from "@propertyflow/contracts";
import type { PropertyStatus } from "@propertyflow/domain";

export const PROPERTY_STATUS_HISTORY_REPOSITORY = Symbol("PROPERTY_STATUS_HISTORY_REPOSITORY");

export interface RecordPropertyStatusEventInput {
  tenantId: string;
  propertyId: string;
  previousStatus: PropertyStatus;
  status: PropertyStatus;
  user: RequestUser;
  note?: string;
}

export interface PropertyStatusHistoryRepository {
  record(input: RecordPropertyStatusEventInput): Promise<PropertyStatusEventSnapshot>;
  listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyStatusEventSnapshot[]>;
}
