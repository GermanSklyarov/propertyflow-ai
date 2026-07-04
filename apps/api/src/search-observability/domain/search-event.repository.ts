import type { RequestUser, SearchEventSource } from "@propertyflow/contracts";

export const SEARCH_EVENT_REPOSITORY = Symbol("SEARCH_EVENT_REPOSITORY");

export interface RecordSearchEventInput {
  tenantId: string;
  user?: RequestUser;
  source: SearchEventSource;
  query?: string;
  filters: object;
  totalResults: number;
  latencyMs: number;
}

export interface SearchEventRepository {
  record(input: RecordSearchEventInput): Promise<void>;
}
