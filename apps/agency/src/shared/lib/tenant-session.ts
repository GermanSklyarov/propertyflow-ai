import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const selectedTenantCookie = "propertyflow-agency-tenant";
const agencyAccessTokenCookie = "propertyflow-agency-access-token";

export interface AgencySession {
  accessToken: string;
  tenantId: string;
}

export async function getAgencyAccessToken() {
  return (await cookies()).get(agencyAccessTokenCookie)?.value;
}

export async function getSelectedTenantId() {
  return (await cookies()).get(selectedTenantCookie)?.value;
}

export async function getAgencySession(): Promise<AgencySession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(agencyAccessTokenCookie)?.value?.trim();
  const tenantId = cookieStore.get(selectedTenantCookie)?.value?.trim();

  return accessToken && tenantId ? { accessToken, tenantId } : null;
}

export async function requireAgencySession(): Promise<AgencySession> {
  const session = await getAgencySession();

  if (!session) {
    redirect("/signin?error=session-required");
  }

  return session;
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
