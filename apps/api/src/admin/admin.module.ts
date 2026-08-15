import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AdminDashboardService } from "./application/admin-dashboard.service.js";
import { ADMIN_DASHBOARD_REPOSITORY } from "./domain/admin-dashboard.repository.js";
import { PgAdminDashboardRepository } from "./infrastructure/postgres/pg-admin-dashboard.repository.js";
import { AdminDashboardController } from "./presentation/rest/admin-dashboard.controller.js";
import { SuperAdminGuard } from "./presentation/rest/super-admin.guard.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AdminDashboardController],
  providers: [
    AdminDashboardService,
    SuperAdminGuard,
    {
      provide: ADMIN_DASHBOARD_REPOSITORY,
      useClass: PgAdminDashboardRepository,
    },
  ],
})
export class AdminModule {}
