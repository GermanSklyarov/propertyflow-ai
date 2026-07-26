import { forwardRef, Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantGuard } from "../shared/presentation/tenant.guard.js";
import { UsersModule } from "../users/users.module.js";
import { TenantService } from "./application/tenant.service.js";
import { AGENCY_REFRESH_TOKEN_REPOSITORY } from "./domain/agency-refresh-token.repository.js";
import { TENANT_REPOSITORY } from "./domain/tenant.repository.js";
import { PgAgencyRefreshTokenRepository } from "./infrastructure/postgres/pg-agency-refresh-token.repository.js";
import { PgTenantRepository } from "./infrastructure/postgres/pg-tenant.repository.js";
import { CurrentTenantController } from "./presentation/rest/current-tenant.controller.js";
import { PublicWidgetConfigController } from "./presentation/rest/public-widget-config.controller.js";
import { TenantProvisioningController } from "./presentation/rest/tenant-provisioning.controller.js";

@Module({
  imports: [forwardRef(() => AuditModule), AuthModule, DatabaseModule, UsersModule],
  controllers: [CurrentTenantController, PublicWidgetConfigController, TenantProvisioningController],
  providers: [
    TenantService,
    TenantGuard,
    {
      provide: TENANT_REPOSITORY,
      useClass: PgTenantRepository
    },
    {
      provide: AGENCY_REFRESH_TOKEN_REPOSITORY,
      useClass: PgAgencyRefreshTokenRepository
    }
  ],
  exports: [TenantService, TenantGuard]
})
export class TenantsModule {}
