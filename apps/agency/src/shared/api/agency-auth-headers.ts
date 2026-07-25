export interface AgencyApiAuthOptions {
  accessToken?: string;
  tenantId?: string;
}

export function buildAgencyApiHeaders(options: AgencyApiAuthOptions = {}): Record<string, string> {
  const tenantId = options.tenantId ?? process.env.PROPERTYFLOW_TENANT_ID ?? "demo-agency";
  const accessToken = (options.accessToken ?? process.env.PROPERTYFLOW_AGENCY_ACCESS_TOKEN)?.trim();

  if (accessToken) {
    return {
      "authorization": `Bearer ${accessToken}`,
      "x-tenant-id": tenantId
    };
  }

  return {
    "x-tenant-id": tenantId,
    "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
    "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
  };
}
