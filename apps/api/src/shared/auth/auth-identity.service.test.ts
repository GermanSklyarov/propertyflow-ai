import { createHmac } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthIdentityService } from "./auth-identity.service.js";

describe("AuthIdentityService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("uses a verified bearer token subject as the request user id", () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T09:00:00.000Z"));
    const service = new AuthIdentityService();
    const token = signToken({ exp: 1_785_229_200, sub: "user-auth-1" }, "test-secret");

    expect(
      service.getRequestUserId({
        headers: {
          authorization: `Bearer ${token}`,
          "x-user-id": "spoofed-dev-user"
        }
      })
    ).toBe("user-auth-1");
  });

  it("issues a bearer token that resolves to the owner user id", () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T09:00:00.000Z"));
    const service = new AuthIdentityService();
    const token = service.issueAccessToken("owner-user-1", 900);

    expect(
      service.getRequestUserId({
        headers: {
          authorization: `Bearer ${token}`
        }
      })
    ).toBe("owner-user-1");
  });

  it("rejects bearer tokens with an invalid signature", () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    const service = new AuthIdentityService();
    const token = signToken({ sub: "user-auth-1" }, "other-secret");

    expect(() =>
      service.getRequestUserId({
        headers: {
          authorization: `Bearer ${token}`
        }
      })
    ).toThrow(UnauthorizedException);
  });

  it("disables development identity headers in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const service = new AuthIdentityService();

    expect(() =>
      service.getRequestUserId({
        headers: {
          "x-user-id": "manager-demo-1"
        }
      })
    ).toThrow(UnauthorizedException);
  });
});

function signToken(payload: Record<string, unknown>, secret: string) {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");

  return `${header}.${body}.${signature}`;
}

function encodeJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
