import { getStarterAdminDashboard } from "@shared/api/admin-client";
import { SuperAdminDashboardPage } from "@views/super-admin-dashboard/ui/super-admin-dashboard-page";

export default async function AdminHomeRoute() {
  const dashboard = await getStarterAdminDashboard();

  return <SuperAdminDashboardPage dashboard={dashboard.data} isDemo={dashboard.isDemo} loadError={dashboard.error} />;
}
