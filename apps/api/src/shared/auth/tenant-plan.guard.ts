import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TenantSnapshot, TenantSubscriptionPlan } from "@propertyflow/contracts";
import { TENANT_PLANS_KEY } from "./tenant-plan.decorator.js";

interface TenantAwareRequest {
  tenant?: TenantSnapshot;
}

@Injectable()
export class TenantPlanGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlans = this.reflector.getAllAndOverride<TenantSubscriptionPlan[]>(TENANT_PLANS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPlans?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantAwareRequest>();
    const plan = request.tenant?.subscriptionPlan;

    if (!plan || !requiredPlans.includes(plan)) {
      throw new ForbiddenException(
        `Tenant plan must be one of ${requiredPlans.join(", ")} to access this feature`
      );
    }

    return true;
  }
}
