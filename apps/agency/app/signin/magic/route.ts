import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exchangeAgencyMagicLink } from "@shared/api/agency-client";
import {
  agencyAccessTokenCookie,
  agencyRefreshTokenCookie,
  selectedTenantCookie
} from "@shared/lib/agency-session-middleware";

export async function GET(request: NextRequest) {
  const magicToken = request.nextUrl.searchParams.get("token")?.trim();
  const tenantSlug = request.nextUrl.searchParams.get("workspace")?.trim();

  if (!magicToken || !tenantSlug) {
    return redirectToSignin(request, "magic-link-invalid");
  }

  const session = await exchangeAgencyMagicLink({
    tenantSlug,
    token: magicToken
  }).catch(() => null);

  if (!session) {
    return redirectToSignin(request, "magic-link-invalid");
  }

  const response = NextResponse.redirect(new URL(session.setupUrl, request.url));
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(agencyAccessTokenCookie, session.accessToken, {
    expires: new Date(session.accessTokenExpiresAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure
  });
  response.cookies.set(agencyRefreshTokenCookie, session.refreshToken, {
    expires: new Date(session.refreshTokenExpiresAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure
  });
  response.cookies.set(selectedTenantCookie, session.tenant.id, {
    expires: new Date(session.refreshTokenExpiresAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure
  });

  revalidatePath("/", "layout");

  return response;
}

function redirectToSignin(request: NextRequest, error: "magic-link-invalid") {
  return NextResponse.redirect(new URL(`/signin?error=${error}`, request.url));
}
