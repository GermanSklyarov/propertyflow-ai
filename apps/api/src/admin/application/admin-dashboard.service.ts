import { Inject, Injectable } from "@nestjs/common";
import type { SuperAdminDashboardResponse } from "@propertyflow/contracts";
import {
  ADMIN_DASHBOARD_REPOSITORY,
  type AdminDashboardRepository,
} from "../domain/admin-dashboard.repository.js";

@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(ADMIN_DASHBOARD_REPOSITORY)
    private readonly dashboard: AdminDashboardRepository,
  ) {}

  getStarterDashboard(): Promise<SuperAdminDashboardResponse> {
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    return this.dashboard.getDashboard(periodStart, periodEnd, todayStart);
  }
}
