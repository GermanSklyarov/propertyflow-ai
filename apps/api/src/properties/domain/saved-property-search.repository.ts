import type { SavedPropertySearchSnapshot } from "@propertyflow/contracts";

export const SAVED_PROPERTY_SEARCH_REPOSITORY = Symbol("SAVED_PROPERTY_SEARCH_REPOSITORY");

export interface SavePropertySearchInput {
  tenantId: string;
  userId?: string;
  title: string;
  naturalLanguageQuery?: string;
  locale?: SavedPropertySearchSnapshot["locale"];
  purpose?: SavedPropertySearchSnapshot["purpose"];
  filters: SavedPropertySearchSnapshot["filters"];
  matchCount: number;
  notificationsEnabled: boolean;
}

export interface SavedPropertySearchLeadFunnelRow {
  savedSearch: SavedPropertySearchSnapshot;
  leadCount: number;
  latestLeadAt?: string;
}

export interface SavedPropertySearchRepository {
  save(input: SavePropertySearchInput): Promise<SavedPropertySearchSnapshot>;
  list(tenantId: string, userId?: string): Promise<SavedPropertySearchSnapshot[]>;
  listLeadFunnel(tenantId: string, userId?: string): Promise<SavedPropertySearchLeadFunnelRow[]>;
  findById(tenantId: string, searchId: string): Promise<SavedPropertySearchSnapshot | null>;
  updateNotifications(
    tenantId: string,
    searchId: string,
    notificationsEnabled: boolean
  ): Promise<SavedPropertySearchSnapshot | null>;
  delete(tenantId: string, searchId: string): Promise<SavedPropertySearchSnapshot | null>;
}
