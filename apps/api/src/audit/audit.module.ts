import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AuditService } from "./application/audit.service.js";
import { AUDIT_REPOSITORY } from "./domain/audit.repository.js";
import { PgAuditRepository } from "./infrastructure/postgres/pg-audit.repository.js";

@Module({
  imports: [DatabaseModule],
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

