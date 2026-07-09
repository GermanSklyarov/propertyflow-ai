import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { UsersModule } from "../users/users.module.js";
import { PROPERTY_REPOSITORY } from "../properties/domain/property.repository.js";
import { PgPropertyRepository } from "../properties/infrastructure/postgres/pg-property.repository.js";
import { LeadService } from "./application/lead.service.js";
import { LEAD_REPOSITORY } from "./domain/lead.repository.js";
import { PgLeadRepository } from "./infrastructure/postgres/pg-lead.repository.js";
import { LeadsController } from "./presentation/rest/leads.controller.js";

@Module({
  imports: [AuditModule, AuthModule, DatabaseModule, RealtimeModule, TenantsModule, UsersModule],
  controllers: [LeadsController],
  providers: [
    LeadService,
    {
      provide: LEAD_REPOSITORY,
      useClass: PgLeadRepository
    },
    {
      provide: PROPERTY_REPOSITORY,
      useClass: PgPropertyRepository
    }
  ],
  exports: [LeadService]
})
export class LeadsModule {}
