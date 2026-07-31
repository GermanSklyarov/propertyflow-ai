import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type {
  AgencyEmailTokenPurpose,
  AgencyEmailTokenRecord,
  AgencyEmailTokenRepository,
  CreateAgencyEmailTokenInput
} from "../domain/agency-email-token.repository.js";
import { AgencyEmailTokenService } from "./agency-email-token.service.js";

describe("AgencyEmailTokenService", () => {
  it("issues a one-time token, normalizes email, and revokes older active tokens for the same purpose", async () => {
    const repository = new InMemoryAgencyEmailTokenRepository();
    const service = new AgencyEmailTokenService(repository);
    const now = new Date("2026-07-31T08:00:00.000Z");
    const first = await service.issue({
      email: " Owner@Agency.Example ",
      now,
      purpose: "workspace-invitation",
      tenantId: " demo-agency ",
      ttlMinutes: 60
    });

    const second = await service.issue({
      email: "owner@agency.example",
      metadata: { role: "owner" },
      now: new Date("2026-07-31T08:05:00.000Z"),
      purpose: "workspace-invitation",
      tenantId: "demo-agency",
      ttlMinutes: 30
    });

    expect(first.token).not.toBe(first.record.tokenHash);
    expect(first.record.email).toBe("owner@agency.example");
    expect(first.record.expiresAt.toISOString()).toBe("2026-07-31T09:00:00.000Z");
    expect(second.record.metadata).toEqual({ role: "owner" });
    expect(second.record.expiresAt.toISOString()).toBe("2026-07-31T08:35:00.000Z");
    expect(repository.records.get(first.record.id)?.revokedAt?.toISOString()).toBe("2026-07-31T08:05:00.000Z");
  });

  it("consumes a matching token only once", async () => {
    const repository = new InMemoryAgencyEmailTokenRepository();
    const service = new AgencyEmailTokenService(repository);
    const issued = await service.issue({
      email: "owner@agency.example",
      now: new Date("2026-07-31T08:00:00.000Z"),
      purpose: "magic-link",
      tenantId: "demo-agency",
      ttlMinutes: 15
    });

    await expect(
      service.consume({
        now: new Date("2026-07-31T08:05:00.000Z"),
        purpose: "magic-link",
        tenantId: "demo-agency",
        token: issued.token
      })
    ).resolves.toMatchObject({
      consumedAt: new Date("2026-07-31T08:05:00.000Z"),
      email: "owner@agency.example",
      tenantId: "demo-agency"
    });
    await expect(
      service.consume({
        now: new Date("2026-07-31T08:06:00.000Z"),
        purpose: "magic-link",
        tenantId: "demo-agency",
        token: issued.token
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects tokens scoped to another tenant or purpose", async () => {
    const repository = new InMemoryAgencyEmailTokenRepository();
    const service = new AgencyEmailTokenService(repository);
    const issued = await service.issue({
      email: "owner@agency.example",
      purpose: "email-verification",
      tenantId: "demo-agency"
    });

    await expect(
      service.consume({
        purpose: "workspace-invitation",
        tenantId: "demo-agency",
        token: issued.token
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.consume({
        purpose: "email-verification",
        tenantId: "other-agency",
        token: issued.token
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("validates required tenant, email, and ttl", async () => {
    const service = new AgencyEmailTokenService(new InMemoryAgencyEmailTokenRepository());

    await expect(
      service.issue({
        email: "",
        purpose: "magic-link",
        tenantId: "demo-agency"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.issue({
        email: "owner@agency.example",
        purpose: "magic-link",
        tenantId: " ",
        ttlMinutes: 0
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

class InMemoryAgencyEmailTokenRepository implements AgencyEmailTokenRepository {
  readonly records = new Map<string, AgencyEmailTokenRecord>();

  async create(input: CreateAgencyEmailTokenInput): Promise<AgencyEmailTokenRecord> {
    const record = {
      consumedAt: null,
      revokedAt: null,
      ...input
    };
    this.records.set(record.id, record);

    return record;
  }

  async findUsableByHash(tokenHash: string, now: Date): Promise<AgencyEmailTokenRecord | null> {
    return (
      Array.from(this.records.values()).find(
        (record) =>
          record.tokenHash === tokenHash &&
          !record.consumedAt &&
          !record.revokedAt &&
          record.expiresAt.getTime() > now.getTime()
      ) ?? null
    );
  }

  async consume(tokenId: string, consumedAt: Date): Promise<AgencyEmailTokenRecord | null> {
    const record = this.records.get(tokenId);

    if (!record || record.consumedAt || record.revokedAt) {
      return null;
    }

    const consumed = { ...record, consumedAt };
    this.records.set(tokenId, consumed);

    return consumed;
  }

  async revokeActiveForEmail(
    tenantId: string,
    email: string,
    purpose: AgencyEmailTokenPurpose,
    revokedAt: Date
  ): Promise<number> {
    let revoked = 0;

    for (const record of this.records.values()) {
      if (
        record.tenantId === tenantId &&
        record.email === email &&
        record.purpose === purpose &&
        !record.consumedAt &&
        !record.revokedAt
      ) {
        this.records.set(record.id, { ...record, revokedAt });
        revoked += 1;
      }
    }

    return revoked;
  }
}
