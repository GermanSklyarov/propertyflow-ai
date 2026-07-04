import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantGuard } from "../shared/presentation/tenant.guard.js";
import { TenantService } from "./application/tenant.service.js";
import { TENANT_REPOSITORY } from "./domain/tenant.repository.js";
import { PgTenantRepository } from "./infrastructure/postgres/pg-tenant.repository.js";
import { CurrentTenantController } from "./presentation/rest/current-tenant.controller.js";

@Module({
  imports: [AuditModule, AuthModule, DatabaseModule],
  controllers: [CurrentTenantController],
  providers: [
    TenantService,
    TenantGuard,
    {
      provide: TENANT_REPOSITORY,
      useClass: PgTenantRepository
    }
  ],
  exports: [TenantService, TenantGuard]
})
export class TenantsModule {}
