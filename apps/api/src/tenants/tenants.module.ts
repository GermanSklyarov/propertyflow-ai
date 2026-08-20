import { forwardRef, Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantGuard } from "../shared/presentation/tenant.guard.js";
import { UsersModule } from "../users/users.module.js";
import { TenantService } from "./application/tenant.service.js";
import { AgencyEmailTokenService } from "./application/agency-email-token.service.js";
import { AGENCY_EMAIL_TOKEN_REPOSITORY } from "./domain/agency-email-token.repository.js";
import { AGENCY_REFRESH_TOKEN_REPOSITORY } from "./domain/agency-refresh-token.repository.js";
import { NOTIFICATION_CONNECTION_TOKEN_REPOSITORY } from "./domain/notification-connection-token.repository.js";
import { TENANT_REPOSITORY } from "./domain/tenant.repository.js";
import { PgAgencyEmailTokenRepository } from "./infrastructure/postgres/pg-agency-email-token.repository.js";
import { PgAgencyRefreshTokenRepository } from "./infrastructure/postgres/pg-agency-refresh-token.repository.js";
import { PgNotificationConnectionTokenRepository } from "./infrastructure/postgres/pg-notification-connection-token.repository.js";
import { PgTenantRepository } from "./infrastructure/postgres/pg-tenant.repository.js";
import { CurrentTenantController } from "./presentation/rest/current-tenant.controller.js";
import { PublicWidgetConfigController } from "./presentation/rest/public-widget-config.controller.js";
import { TenantProvisioningController } from "./presentation/rest/tenant-provisioning.controller.js";

@Module({
  imports: [forwardRef(() => AuditModule), AuthModule, DatabaseModule, UsersModule],
  controllers: [CurrentTenantController, PublicWidgetConfigController, TenantProvisioningController],
  providers: [
    AgencyEmailTokenService,
    TenantService,
    TenantGuard,
    {
      provide: TENANT_REPOSITORY,
      useClass: PgTenantRepository
    },
    {
      provide: AGENCY_REFRESH_TOKEN_REPOSITORY,
      useClass: PgAgencyRefreshTokenRepository
    },
    {
      provide: AGENCY_EMAIL_TOKEN_REPOSITORY,
      useClass: PgAgencyEmailTokenRepository
    },
    {
      provide: NOTIFICATION_CONNECTION_TOKEN_REPOSITORY,
      useClass: PgNotificationConnectionTokenRepository
    }
  ],
  exports: [AgencyEmailTokenService, TenantService, TenantGuard]
})
export class TenantsModule {}
