export interface AgencyApiAuthOptions {
  accessToken?: string;
  tenantId?: string;
}

export function buildAgencyApiHeaders(options: AgencyApiAuthOptions = {}): Record<string, string> {
  const tenantId = (options.tenantId ?? process.env.PROPERTYFLOW_TENANT_ID)?.trim();
  const accessToken = (options.accessToken ?? process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN)?.trim();

  if (accessToken) {
    if (!tenantId) {
      throw new Error("Tenant id is required for agency API requests");
    }

    return {
      "authorization": `Bearer ${accessToken}`,
      "x-tenant-id": tenantId
    };
  }

  if (process.env.PROPERTYFLOW_ALLOW_DEV_AUTH_HEADERS !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Agency API access token is required");
  }

  return {
    "x-tenant-id": tenantId ?? "demo-agency",
    "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
    "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
  };
}
