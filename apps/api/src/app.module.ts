import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./shared/auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { PropertiesModule } from "./properties/properties.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";

@Module({
  imports: [CqrsModule.forRoot(), AuditModule, AuthModule, DatabaseModule, TenantsModule, PropertiesModule]
})
export class AppModule {}
