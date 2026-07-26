import { afterEach, describe, expect, it } from "vitest";
import { buildAgencyApiHeaders } from "./agency-auth-headers";

const originalEnv = { ...process.env };

describe("buildAgencyApiHeaders", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses bearer token identity when an agency access token is configured", () => {
    process.env.PROPERTYFLOW_TENANT_ID = "tenant-a";
    process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN = " signed-token ";
    process.env.PROPERTYFLOW_USER_ID = "spoofed-user";
    process.env.PROPERTYFLOW_USER_ROLE = "admin";

    expect(buildAgencyApiHeaders()).toEqual({
      "authorization": "Bearer signed-token",
      "x-tenant-id": "tenant-a"
    });
  });

  it("allows explicit tenant selection without trusting role headers", () => {
    process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN = "tenant-token";

    expect(buildAgencyApiHeaders({ tenantId: "tenant-b" })).toEqual({
      "authorization": "Bearer tenant-token",
      "x-tenant-id": "tenant-b"
    });
  });

  it("rejects implicit development identity headers without an explicit opt-in", () => {
    delete process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN;
    delete process.env.PROPERTYFLOW_ALLOW_DEV_AUTH_HEADERS;
    process.env.PROPERTYFLOW_TENANT_ID = "demo-agency";
    process.env.PROPERTYFLOW_USER_ID = "manager-demo-1";
    process.env.PROPERTYFLOW_USER_ROLE = "manager";

    expect(() => buildAgencyApiHeaders()).toThrow("Agency API access token is required");
  });

  it("keeps development identity headers only when explicitly enabled", () => {
    delete process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN;
    process.env.PROPERTYFLOW_ALLOW_DEV_AUTH_HEADERS = "true";
    process.env.PROPERTYFLOW_TENANT_ID = "demo-agency";
    process.env.PROPERTYFLOW_USER_ID = "manager-demo-1";
    process.env.PROPERTYFLOW_USER_ROLE = "manager";

    expect(buildAgencyApiHeaders()).toEqual({
      "x-tenant-id": "demo-agency",
      "x-user-id": "manager-demo-1",
      "x-user-role": "manager"
    });
  });

  it("requires tenant context for bearer-authenticated agency calls", () => {
    delete process.env.PROPERTYFLOW_TENANT_ID;
    process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN = "tenant-token";

    expect(() => buildAgencyApiHeaders()).toThrow("Tenant id is required");
  });
});
