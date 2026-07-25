import { Module } from "@nestjs/common";
import { UsersModule } from "../../users/users.module.js";
import { AuthIdentityService } from "./auth-identity.service.js";
import { RolesGuard } from "./roles.guard.js";
import { UserContextGuard } from "./user-context.guard.js";

@Module({
  imports: [UsersModule],
  providers: [AuthIdentityService, RolesGuard, UserContextGuard],
  exports: [AuthIdentityService, RolesGuard, UserContextGuard, UsersModule]
})
export class AuthModule {}
