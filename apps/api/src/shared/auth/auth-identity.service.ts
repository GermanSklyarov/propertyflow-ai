import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";

interface JwtPayload {
  exp?: number;
  nbf?: number;
  sub?: unknown;
}

interface HeaderAwareRequest {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class AuthIdentityService {
  getRequestUserId(request: HeaderAwareRequest): string | undefined {
    const authorization = this.readHeader(request, "authorization");

    if (authorization) {
      return this.verifyBearerToken(authorization);
    }

    const devUserId = this.readHeader(request, "x-user-id");

    if (devUserId && process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Development identity headers are disabled in production");
    }

    return devUserId;
  }

  private verifyBearerToken(authorization: string): string {
    const [scheme, token] = authorization.split(/\s+/, 2);

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Invalid authorization header");
    }

    const secret = process.env.PROPERTYFLOW_ACCESS_TOKEN_SECRET;

    if (!secret) {
      throw new UnauthorizedException("Access token verification is not configured");
    }

    const [encodedHeader, encodedPayload, signature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid access token");
    }

    const header = this.decodeJson<{ alg?: string; typ?: string }>(encodedHeader);

    if (header.alg !== "HS256") {
      throw new UnauthorizedException("Unsupported access token algorithm");
    }

    const expectedSignature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
    const actualSignature = this.decodeBase64Url(signature);

    if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
      throw new UnauthorizedException("Invalid access token signature");
    }

    const payload = this.decodeJson<JwtPayload>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp <= now) {
      throw new UnauthorizedException("Access token expired");
    }

    if (payload.nbf && payload.nbf > now) {
      throw new UnauthorizedException("Access token is not active yet");
    }

    if (typeof payload.sub !== "string" || !payload.sub.trim()) {
      throw new UnauthorizedException("Access token subject is required");
    }

    return payload.sub;
  }

  private decodeJson<T>(value: string): T {
    try {
      return JSON.parse(this.decodeBase64Url(value).toString("utf8")) as T;
    } catch {
      throw new UnauthorizedException("Invalid access token payload");
    }
  }

  private decodeBase64Url(value: string): Buffer {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  }

  private readHeader(request: HeaderAwareRequest, header: string): string | undefined {
    const value = request.headers[header];
    return Array.isArray(value) ? value[0] : value;
  }
}
