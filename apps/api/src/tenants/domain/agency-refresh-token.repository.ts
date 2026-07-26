export const AGENCY_REFRESH_TOKEN_REPOSITORY = Symbol("AGENCY_REFRESH_TOKEN_REPOSITORY");

export interface AgencyRefreshTokenRecord {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByTokenId?: string | null;
  createdAt: Date;
}

export interface CreateAgencyRefreshTokenInput {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AgencyRefreshTokenRepository {
  create(input: CreateAgencyRefreshTokenInput): Promise<AgencyRefreshTokenRecord>;
  findActiveByHash(tokenHash: string, now: Date): Promise<AgencyRefreshTokenRecord | null>;
  rotate(
    currentTokenId: string,
    input: CreateAgencyRefreshTokenInput
  ): Promise<AgencyRefreshTokenRecord | null>;
}
