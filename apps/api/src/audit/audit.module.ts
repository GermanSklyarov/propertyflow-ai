import { forwardRef, Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AuditService } from "./application/audit.service.js";
import { AUDIT_REPOSITORY } from "./domain/audit.repository.js";
import { PgAuditRepository } from "./infrastructure/postgres/pg-audit.repository.js";
import { AuditEventsController } from "./presentation/rest/audit-events.controller.js";

@Module({
  imports: [AuthModule, DatabaseModule, forwardRef(() => TenantsModule)],
  controllers: [AuditEventsController],
  providers: [
    AuditService,
    {
      provide: AUDIT_REPOSITORY,
      useClass: PgAuditRepository
    }
  ],
  exports: [AuditService]
})
export class AuditModule {}
