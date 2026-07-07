import type { SavedSearchAlertRunSnapshot } from "@propertyflow/contracts";

export const SAVED_SEARCH_ALERT_RUN_REPOSITORY = Symbol("SAVED_SEARCH_ALERT_RUN_REPOSITORY");

export interface ListSavedSearchAlertRunsRequest {
  tenantId: string;
  userId?: string;
  limit?: number;
}

export interface SavedSearchAlertRunRepository {
  list(request: ListSavedSearchAlertRunsRequest): Promise<SavedSearchAlertRunSnapshot[]>;
  findById(tenantId: string, runId: string): Promise<SavedSearchAlertRunSnapshot | null>;
}
