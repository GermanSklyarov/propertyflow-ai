import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "@propertyflow/contracts";

interface UserAwareRequest {
  user?: RequestUser;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  const request = context.switchToHttp().getRequest<UserAwareRequest>();

  if (!request.user) {
    throw new Error("UserContextGuard did not attach user to request");
  }

  return request.user;
});

