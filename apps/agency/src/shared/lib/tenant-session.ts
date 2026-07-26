import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const selectedTenantCookie = "propertyflow-agency-tenant";
const agencyAccessTokenCookie = "propertyflow-agency-access-token";
const agencyRefreshTokenCookie = "propertyflow-agency-refresh-token";

export interface AgencySession {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
}

interface SetAgencySessionInput extends AgencySession {
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

export async function getAgencySession(): Promise<AgencySession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(agencyAccessTokenCookie)?.value?.trim();
  const refreshToken = cookieStore.get(agencyRefreshTokenCookie)?.value?.trim();
  const tenantId = cookieStore.get(selectedTenantCookie)?.value?.trim();

  return accessToken && refreshToken && tenantId ? { accessToken, refreshToken, tenantId } : null;
}

export async function requireAgencySession(): Promise<AgencySession> {
  const session = await getAgencySession();

  if (!session) {
    redirect("/signin?error=session-required");
  }

  return session;
}

export async function setAgencyAccessToken(accessToken: string, expiresAt?: string) {
  (await cookies()).set(agencyAccessTokenCookie, accessToken, {
    httpOnly: true,
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function setAgencyRefreshToken(refreshToken: string, expiresAt?: string) {
  (await cookies()).set(agencyRefreshTokenCookie, refreshToken, {
    httpOnly: true,
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function setAgencySession(session: SetAgencySessionInput) {
  await setAgencyAccessToken(session.accessToken, session.accessTokenExpiresAt);
  await setAgencyRefreshToken(session.refreshToken, session.refreshTokenExpiresAt);
  await setSelectedTenantId(session.tenantId);
}

export async function setSelectedTenantId(tenantId: string) {
  (await cookies()).set(selectedTenantCookie, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}
