import type {
  CreateListingSourceRequest,
  ListingSourceSnapshot,
  ListingSourceSyncInterval
} from "@propertyflow/contracts";

export const LISTING_SOURCE_REPOSITORY = Symbol("LISTING_SOURCE_REPOSITORY");

export interface ListingSourceRepository {
  save(tenantId: string, request: CreateListingSourceRequest): Promise<ListingSourceSnapshot>;
  list(tenantId: string): Promise<ListingSourceSnapshot[]>;
  findById(tenantId: string, sourceId: string): Promise<ListingSourceSnapshot | null>;
  markSyncStarted(tenantId: string, sourceId: string): Promise<ListingSourceSnapshot | null>;
  updateSchedule(
    tenantId: string,
    sourceId: string,
    syncInterval: ListingSourceSyncInterval,
    nextSyncAt?: Date
  ): Promise<ListingSourceSnapshot | null>;
}
