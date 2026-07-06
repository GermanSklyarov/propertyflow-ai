import type { PublicApiKeySnapshot } from "@propertyflow/contracts";

export const PUBLIC_API_KEY_REPOSITORY = Symbol("PUBLIC_API_KEY_REPOSITORY");

export interface PublicApiKeyRepository {
  findActiveByHash(keyHash: string): Promise<PublicApiKeySnapshot | null>;
  getPublicApiMonthlyUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<PublicApiMonthlyUsage>;
  markUsed(apiKeyId: string): Promise<void>;
  recordUsage(tenantId: string, apiKeyId: string, route: string): Promise<void>;
}

export interface PublicApiMonthlyUsage {
  used: number;
  limit: number;
}
