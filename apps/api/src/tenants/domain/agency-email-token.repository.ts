export const AGENCY_EMAIL_TOKEN_REPOSITORY = Symbol("AGENCY_EMAIL_TOKEN_REPOSITORY");

export type AgencyEmailTokenPurpose = "workspace-invitation" | "email-verification" | "magic-link";

export interface AgencyEmailTokenRecord {
  id: string;
  tenantId: string;
  email: string;
  purpose: AgencyEmailTokenPurpose;
  tokenHash: string;
  metadata: Record<string, unknown>;
  expiresAt: Date;
  consumedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface CreateAgencyEmailTokenInput {
  id: string;
  tenantId: string;
  email: string;
  purpose: AgencyEmailTokenPurpose;
  tokenHash: string;
  metadata: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

export interface AgencyEmailTokenRepository {
  create(input: CreateAgencyEmailTokenInput): Promise<AgencyEmailTokenRecord>;
  findUsableByHash(tokenHash: string, now: Date): Promise<AgencyEmailTokenRecord | null>;
  consume(tokenId: string, consumedAt: Date): Promise<AgencyEmailTokenRecord | null>;
  revokeActiveForEmail(
    tenantId: string,
    email: string,
    purpose: AgencyEmailTokenPurpose,
    revokedAt: Date
  ): Promise<number>;
}
