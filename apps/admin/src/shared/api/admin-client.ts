import type { SuperAdminDashboardResponse } from "@propertyflow/contracts";
import { demoDashboard } from "@views/super-admin-dashboard/model/demo-dashboard";

const apiBaseUrl = process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

export interface AdminDashboardLoadResult {
  data: SuperAdminDashboardResponse;
  error?: string;
  isDemo: boolean;
}

export async function getStarterAdminDashboard(): Promise<AdminDashboardLoadResult> {
  const adminKey = process.env.PROPERTYFLOW_ADMIN_KEY;

  if (!adminKey) {
    return {
      data: demoDashboard,
      error: "PROPERTYFLOW_ADMIN_KEY is not configured for the admin app.",
      isDemo: true
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/admin/starter-dashboard`, {
      headers: {
        "x-admin-key": adminKey
      },
      next: {
        revalidate: 15
      }
    });

    if (!response.ok) {
      throw new Error(`Admin API responded with HTTP ${response.status}`);
    }

    return {
      data: (await response.json()) as SuperAdminDashboardResponse,
      isDemo: false
    };
  } catch (error) {
    return {
      data: demoDashboard,
      error: error instanceof Error ? error.message : "Could not load the admin dashboard.",
      isDemo: true
    };
  }
}
