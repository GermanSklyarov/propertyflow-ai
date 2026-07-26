import { describe, expect, it } from "vitest";
import {
  agencyAccessTokenCookie,
  agencyRefreshTokenCookie,
  isAgencyApiPath,
  isAgencyAuthEntryPath,
  isAccessTokenFresh,
  isAgencyEntryPath,
  mergeCookieHeader,
  selectedTenantCookie,
  shouldSkipAgencySessionMiddleware
} from "./agency-session-middleware";

describe("agency session middleware helpers", () => {
  it("skips entry and asset paths without treating dashboard paths as public", () => {
    expect(isAgencyEntryPath("/")).toBe(true);
    expect(isAgencyEntryPath("/signin")).toBe(true);
    expect(isAgencyEntryPath("/signup?plan=starter")).toBe(true);
    expect(isAgencyEntryPath("/settings")).toBe(false);
    expect(isAgencyAuthEntryPath("/")).toBe(false);
    expect(isAgencyAuthEntryPath("/signin")).toBe(true);
    expect(isAgencyAuthEntryPath("/signup?plan=starter")).toBe(true);
    expect(isAgencyApiPath("/api/property-projects")).toBe(true);
    expect(isAgencyApiPath("/settings")).toBe(false);
    expect(shouldSkipAgencySessionMiddleware("/_next/static/app.js")).toBe(true);
    expect(shouldSkipAgencySessionMiddleware("/images/logo.svg")).toBe(true);
    expect(shouldSkipAgencySessionMiddleware("/settings")).toBe(false);
  });

  it("refreshes missing, malformed, expired, and nearly expired access tokens", () => {
    expect(isAccessTokenFresh(undefined, 100)).toBe(false);
    expect(isAccessTokenFresh("not-a-token", 100)).toBe(false);
    expect(isAccessTokenFresh(accessTokenWithExpiration(159), 100)).toBe(false);
    expect(isAccessTokenFresh(accessTokenWithExpiration(161), 100)).toBe(true);
  });

  it("merges refreshed session cookies into the current request header", () => {
    expect(
      mergeCookieHeader("theme=dark; propertyflow-agency-access-token=old", {
        [agencyAccessTokenCookie]: "new-access",
        [agencyRefreshTokenCookie]: "new-refresh",
        [selectedTenantCookie]: "tenant-1"
      })
    ).toBe(
      "theme=dark; propertyflow-agency-access-token=new-access; propertyflow-agency-refresh-token=new-refresh; propertyflow-agency-tenant=tenant-1"
    );
  });
});

function accessTokenWithExpiration(exp: number) {
  return `header.${Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url")}.signature`;
}
