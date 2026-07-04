import { Module } from "@nestjs/common";
import { RolesGuard } from "./roles.guard.js";
import { UserContextGuard } from "./user-context.guard.js";

@Module({
  providers: [RolesGuard, UserContextGuard],
  exports: [RolesGuard, UserContextGuard]
})
export class AuthModule {}

