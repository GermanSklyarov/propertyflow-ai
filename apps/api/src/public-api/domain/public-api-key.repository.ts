import type { PublicApiKeySnapshot } from "@propertyflow/contracts";

export const PUBLIC_API_KEY_REPOSITORY = Symbol("PUBLIC_API_KEY_REPOSITORY");

export interface PublicApiKeyRepository {
  findActiveByHash(keyHash: string): Promise<PublicApiKeySnapshot | null>;
  markUsed(apiKeyId: string): Promise<void>;
}

