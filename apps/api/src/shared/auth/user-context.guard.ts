import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestUser, TenantSnapshot, UserRole } from "@propertyflow/contracts";

const roles: UserRole[] = ["agent", "broker", "manager", "admin"];

interface UserAwareRequest {
  headers: Record<string, string | string[] | undefined>;
  tenant?: TenantSnapshot;
  user?: RequestUser;
}

@Injectable()
export class UserContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<UserAwareRequest>();
    const userId = this.readHeader(request, "x-user-id");
    const role = this.readHeader(request, "x-user-role");

    if (!userId && !role) {
      return true;
    }

    if (!userId || !role) {
      throw new UnauthorizedException("x-user-id and x-user-role must be provided together");
    }

    if (!this.isUserRole(role)) {
      throw new BadRequestException("Invalid x-user-role header");
    }

    request.user = {
      id: userId,
      tenantId: request.tenant?.id ?? this.readHeader(request, "x-tenant-id") ?? "",
      role
    };

    return true;
  }

  private readHeader(request: UserAwareRequest, header: string): string | undefined {
    const value = request.headers[header];
    return Array.isArray(value) ? value[0] : value;
  }

  private isUserRole(value: string): value is UserRole {
    return roles.includes(value as UserRole);
  }
}

