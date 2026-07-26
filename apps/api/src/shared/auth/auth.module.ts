import { Module } from "@nestjs/common";
import { UsersModule } from "../../users/users.module.js";
import { AuthIdentityService } from "./auth-identity.service.js";
import { RolesGuard } from "./roles.guard.js";
import { TenantPlanGuard } from "./tenant-plan.guard.js";
import { UserContextGuard } from "./user-context.guard.js";

@Module({
  imports: [UsersModule],
  providers: [AuthIdentityService, RolesGuard, TenantPlanGuard, UserContextGuard],
  exports: [AuthIdentityService, RolesGuard, TenantPlanGuard, UserContextGuard, UsersModule]
})
export class AuthModule {}
