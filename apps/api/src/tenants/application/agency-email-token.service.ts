import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  AGENCY_EMAIL_TOKEN_REPOSITORY,
  type AgencyEmailTokenPurpose,
  type AgencyEmailTokenRecord,
  type AgencyEmailTokenRepository
} from "../domain/agency-email-token.repository.js";

const defaultTokenTtlMinutesByPurpose: Record<AgencyEmailTokenPurpose, number> = {
  "email-verification": 24 * 60,
  "magic-link": 15,
  "workspace-invitation": 7 * 24 * 60
};

export interface IssueAgencyEmailTokenRequest {
  tenantId: string;
  email: string;
  purpose: AgencyEmailTokenPurpose;
  metadata?: Record<string, unknown>;
  ttlMinutes?: number;
  now?: Date;
}

export interface IssueAgencyEmailTokenResult {
  token: string;
  record: AgencyEmailTokenRecord;
}

export interface ConsumeAgencyEmailTokenRequest {
  tenantId: string;
  token: string;
  purpose: AgencyEmailTokenPurpose;
  now?: Date;
}

@Injectable()
export class AgencyEmailTokenService {
  constructor(@Inject(AGENCY_EMAIL_TOKEN_REPOSITORY) private readonly tokens: AgencyEmailTokenRepository) {}

  async issue(request: IssueAgencyEmailTokenRequest): Promise<IssueAgencyEmailTokenResult> {
    const tenantId = request.tenantId.trim();
    const email = normalizeEmail(request.email);
    const ttlMinutes = request.ttlMinutes ?? defaultTokenTtlMinutesByPurpose[request.purpose];
    const now = request.now ?? new Date();

    if (!tenantId) {
      throw new BadRequestException("Tenant id is required");
    }

    if (!email) {
      throw new BadRequestException("Email is required");
    }

    if (ttlMinutes <= 0) {
      throw new BadRequestException("Token TTL must be positive");
    }

    const token = createEmailTokenValue();
    await this.tokens.revokeActiveForEmail(tenantId, email, request.purpose, now);
    const record = await this.tokens.create({
      createdAt: now,
      email,
      expiresAt: addMinutes(now, ttlMinutes),
      id: randomUUID(),
      metadata: request.metadata ?? {},
      purpose: request.purpose,
      tenantId,
      tokenHash: hashEmailToken(token)
    });

    return { record, token };
  }

  async consume(request: ConsumeAgencyEmailTokenRequest): Promise<AgencyEmailTokenRecord> {
    const tenantId = request.tenantId.trim();
    const now = request.now ?? new Date();
    const token = request.token.trim();

    if (!tenantId || !token) {
      throw new UnauthorizedException("Agency email token is not valid");
    }

    const record = await this.tokens.findUsableByHash(hashEmailToken(token), now);

    if (!record || record.tenantId !== tenantId || record.purpose !== request.purpose) {
      throw new UnauthorizedException("Agency email token is not valid");
    }

    const consumed = await this.tokens.consume(record.id, now);

    if (!consumed) {
      throw new UnauthorizedException("Agency email token is not valid");
    }

    return consumed;
  }
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function createEmailTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
