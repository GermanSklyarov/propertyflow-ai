export const selectedTenantCookie = "propertyflow-agency-tenant";
export const agencyAccessTokenCookie = "propertyflow-agency-access-token";
export const agencyRefreshTokenCookie = "propertyflow-agency-refresh-token";

const accessTokenRefreshWindowSeconds = 60;

export function isAgencyEntryPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/signin") || pathname.startsWith("/signup");
}

export function shouldSkipAgencySessionMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$/i) !== null
  );
}

export function isAccessTokenFresh(accessToken: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const exp = readJwtExpiration(accessToken);

  return Boolean(exp && exp - accessTokenRefreshWindowSeconds > nowSeconds);
}

export function mergeCookieHeader(
  cookieHeader: string | null | undefined,
  replacements: Record<string, string>
): string {
  const cookies = new Map<string, string>();

  for (const cookie of cookieHeader?.split(";") ?? []) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    const name = rawName?.trim();

    if (name) {
      cookies.set(name, rawValue.join("="));
    }
  }

  for (const [name, value] of Object.entries(replacements)) {
    cookies.set(name, value);
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function readJwtExpiration(accessToken: string | undefined): number | null {
  if (!accessToken) {
    return null;
  }

  const [, encodedPayload] = accessToken.split(".");

  if (!encodedPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as { exp?: unknown };

    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  return atob(padded);
}
