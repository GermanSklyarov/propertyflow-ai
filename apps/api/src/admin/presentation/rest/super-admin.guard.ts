import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

interface HeaderAwareRequest {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.PROPERTYFLOW_ADMIN_KEY;

    if (!expectedKey) {
      throw new UnauthorizedException("Super admin access is not configured");
    }

    const request = context.switchToHttp().getRequest<HeaderAwareRequest>();
    const providedKey = this.readHeader(request, "x-admin-key");

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException("Invalid super admin key");
    }

    return true;
  }

  private readHeader(
    request: HeaderAwareRequest,
    header: string,
  ): string | undefined {
    const value = request.headers[header];
    return Array.isArray(value) ? value[0] : value;
  }
}
