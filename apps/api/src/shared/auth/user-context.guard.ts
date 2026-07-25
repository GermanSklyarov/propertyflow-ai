import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { RequestUser, TenantSnapshot } from "@propertyflow/contracts";
import { UserService } from "../../users/application/user.service.js";
import { AuthIdentityService } from "./auth-identity.service.js";

interface UserAwareRequest {
  headers: Record<string, string | string[] | undefined>;
  tenant?: TenantSnapshot;
  user?: RequestUser;
}

@Injectable()
export class UserContextGuard implements CanActivate {
  constructor(
    @Inject(AuthIdentityService) private readonly authIdentity: AuthIdentityService,
    @Inject(UserService) private readonly users: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<UserAwareRequest>();
    const userId = this.authIdentity.getRequestUserId(request);

    if (!userId) {
      return true;
    }

    const tenantId = request.tenant?.id ?? this.readHeader(request, "x-tenant-id");

    if (!tenantId) {
      throw new UnauthorizedException("Tenant context is required for user membership");
    }

    const member = await this.users.getActiveTenantMember(tenantId, userId);

    if (!member) {
      throw new ForbiddenException("User is not a member of this tenant");
    }

    const requestedRole = this.readHeader(request, "x-user-role");

    if (requestedRole && requestedRole !== member.role) {
      throw new ForbiddenException("User role does not match tenant membership");
    }

    request.user = {
      id: member.id,
      tenantId: member.tenantId,
      role: member.role
    };

    return true;
  }

  private readHeader(request: UserAwareRequest, header: string): string | undefined {
    const value = request.headers[header];
    return Array.isArray(value) ? value[0] : value;
  }
}
