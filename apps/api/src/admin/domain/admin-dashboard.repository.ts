import type { SuperAdminDashboardResponse } from "@propertyflow/contracts";

export const ADMIN_DASHBOARD_REPOSITORY = Symbol("ADMIN_DASHBOARD_REPOSITORY");

export interface AdminDashboardRepository {
  getDashboard(
    periodStart: Date,
    periodEnd: Date,
    todayStart: Date,
  ): Promise<SuperAdminDashboardResponse>;
}
