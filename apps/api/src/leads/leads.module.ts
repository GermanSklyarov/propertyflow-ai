import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { LeadService } from "./application/lead.service.js";
import { LEAD_REPOSITORY } from "./domain/lead.repository.js";
import { PgLeadRepository } from "./infrastructure/postgres/pg-lead.repository.js";
import { LeadsController } from "./presentation/rest/leads.controller.js";

@Module({
  imports: [AuditModule, AuthModule, DatabaseModule, TenantsModule],
  controllers: [LeadsController],
  providers: [
    LeadService,
    {
      provide: LEAD_REPOSITORY,
      useClass: PgLeadRepository
    }
  ],
  exports: [LeadService]
})
export class LeadsModule {}

