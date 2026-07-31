import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PgAgencyEmailTokenRepository } from "./pg-agency-email-token.repository.js";

describe("PgAgencyEmailTokenRepository", () => {
  it("creates an email token record", async () => {
    const createdAt = new Date("2026-07-31T08:00:00.000Z");
    const expiresAt = new Date("2026-08-07T08:00:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            consumed_at: null,
            created_at: createdAt,
            email: "owner@agency.example",
            expires_at: expiresAt,
            id: "token-id",
            metadata: { role: "owner" },
            purpose: "workspace-invitation",
            revoked_at: null,
            tenant_id: "demo-agency",
            token_hash: "hash"
          }
        ]
      })
    } as unknown as Pool;
    const repository = new PgAgencyEmailTokenRepository(pool);

    await expect(
      repository.create({
        createdAt,
        email: "owner@agency.example",
        expiresAt,
        id: "token-id",
        metadata: { role: "owner" },
        purpose: "workspace-invitation",
        tenantId: "demo-agency",
        tokenHash: "hash"
      })
    ).resolves.toMatchObject({
      email: "owner@agency.example",
      metadata: { role: "owner" },
      tenantId: "demo-agency"
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("insert into agency_email_tokens"), [
      "token-id",
      "demo-agency",
      "owner@agency.example",
      "workspace-invitation",
      "hash",
      { role: "owner" },
      expiresAt,
      createdAt
    ]);
  });

  it("looks up only usable unconsumed and unrevoked tokens", async () => {
    const now = new Date("2026-07-31T08:00:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    } as unknown as Pool;
    const repository = new PgAgencyEmailTokenRepository(pool);

    await expect(repository.findUsableByHash("hash", now)).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("consumed_at is null"), ["hash", now]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("revoked_at is null"), ["hash", now]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("expires_at > $2"), ["hash", now]);
  });

  it("consumes a token with an idempotency guard", async () => {
    const consumedAt = new Date("2026-07-31T08:00:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            consumed_at: consumedAt,
            created_at: consumedAt,
            email: "owner@agency.example",
            expires_at: new Date("2026-07-31T08:15:00.000Z"),
            id: "token-id",
            metadata: null,
            purpose: "magic-link",
            revoked_at: null,
            tenant_id: "demo-agency",
            token_hash: "hash"
          }
        ]
      })
    } as unknown as Pool;
    const repository = new PgAgencyEmailTokenRepository(pool);

    await expect(repository.consume("token-id", consumedAt)).resolves.toMatchObject({
      consumedAt,
      metadata: {}
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("where id = $2"), [consumedAt, "token-id"]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("consumed_at is null"), [consumedAt, "token-id"]);
  });

  it("revokes active tokens for a tenant email and purpose", async () => {
    const revokedAt = new Date("2026-07-31T08:00:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({ rowCount: 2 })
    } as unknown as Pool;
    const repository = new PgAgencyEmailTokenRepository(pool);

    await expect(
      repository.revokeActiveForEmail("demo-agency", "owner@agency.example", "email-verification", revokedAt)
    ).resolves.toBe(2);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("lower(email) = lower($2)"), [
      "demo-agency",
      "owner@agency.example",
      "email-verification",
      revokedAt
    ]);
  });
});
