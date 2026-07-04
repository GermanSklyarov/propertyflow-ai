import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RequestUser, UserRole } from "@propertyflow/contracts";
import { ROLES_KEY } from "./roles.decorator.js";

interface UserAwareRequest {
  user?: RequestUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<UserAwareRequest>();

    if (!request.user) {
      throw new UnauthorizedException("Missing x-user-id and x-user-role headers");
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException("User role is not allowed to access this route");
    }

    return true;
  }
}

