import { NextResponse, type NextRequest } from "next/server";
import {
  agencyAccessTokenCookie,
  agencyRefreshTokenCookie,
  isAccessTokenFresh,
  isAgencyEntryPath,
  mergeCookieHeader,
  selectedTenantCookie,
  shouldSkipAgencySessionMiddleware
} from "./src/shared/lib/agency-session-middleware";

const apiBaseUrl =
  process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipAgencySessionMiddleware(pathname) || isAgencyEntryPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(agencyAccessTokenCookie)?.value;
  const refreshToken = request.cookies.get(agencyRefreshTokenCookie)?.value;
  const tenantId = request.cookies.get(selectedTenantCookie)?.value;

  if (isAccessTokenFresh(accessToken)) {
    return NextResponse.next();
  }

  if (!refreshToken || !tenantId) {
    return NextResponse.next();
  }

  const refreshed = await refreshAgencySession(refreshToken, tenantId).catch(() => null);

  if (!refreshed) {
    const response = NextResponse.redirect(new URL("/signin?error=session-expired", request.url));

    clearSessionCookies(response);

    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    mergeCookieHeader(request.headers.get("cookie"), {
      [agencyAccessTokenCookie]: refreshed.accessToken,
      [agencyRefreshTokenCookie]: refreshed.refreshToken,
      [selectedTenantCookie]: refreshed.tenant.id
    })
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.cookies.set(agencyAccessTokenCookie, refreshed.accessToken, {
    expires: new Date(refreshed.accessTokenExpiresAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
  response.cookies.set(agencyRefreshTokenCookie, refreshed.refreshToken, {
    expires: new Date(refreshed.refreshTokenExpiresAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
  response.cookies.set(selectedTenantCookie, refreshed.tenant.id, {
    expires: new Date(refreshed.refreshTokenExpiresAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

interface RefreshAgencySessionPayload {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tenant: {
    id: string;
  };
}

async function refreshAgencySession(refreshToken: string, tenantId: string): Promise<RefreshAgencySessionPayload> {
  const response = await fetch(`${apiBaseUrl}/tenants/session/refresh`, {
    body: JSON.stringify({ refreshToken, tenantId }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh agency session: ${response.status}`);
  }

  return (await response.json()) as RefreshAgencySessionPayload;
}

function clearSessionCookies(response: NextResponse) {
  const options = {
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production"
  };

  response.cookies.set(agencyAccessTokenCookie, "", options);
  response.cookies.set(agencyRefreshTokenCookie, "", options);
  response.cookies.set(selectedTenantCookie, "", options);
}
