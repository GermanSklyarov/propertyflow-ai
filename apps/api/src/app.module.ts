import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./shared/auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { LeadsModule } from "./leads/leads.module.js";
import { PropertiesModule } from "./properties/properties.module.js";
import { PublicApiModule } from "./public-api/public-api.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    CqrsModule.forRoot(),
    AnalyticsModule,
    AuditModule,
    AuthModule,
    DatabaseModule,
    TenantsModule,
    UsersModule,
    PropertiesModule,
    LeadsModule,
    PublicApiModule,
    RealtimeModule
  ]
})
export class AppModule {}
