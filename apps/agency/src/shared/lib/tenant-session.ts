import { cookies } from "next/headers";

const selectedTenantCookie = "propertyflow-agency-tenant";
const agencyAccessTokenCookie = "propertyflow-agency-access-token";

export async function getAgencyAccessToken() {
  return (await cookies()).get(agencyAccessTokenCookie)?.value;
}

export async function getSelectedTenantId() {
  return (await cookies()).get(selectedTenantCookie)?.value;
}

export async function setAgencyAccessToken(accessToken: string) {
  (await cookies()).set(agencyAccessTokenCookie, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function setSelectedTenantId(tenantId: string) {
  (await cookies()).set(selectedTenantCookie, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}
