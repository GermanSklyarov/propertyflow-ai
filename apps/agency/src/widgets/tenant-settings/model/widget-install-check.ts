import type { TenantWidgetInstallCheckResponse } from "@propertyflow/contracts";

export function formatWidgetInstallCheckStatus(status: TenantWidgetInstallCheckResponse["status"]) {
  const labels: Record<TenantWidgetInstallCheckResponse["status"], string> = {
    "blocked-origin": "Origin blocked",
    "missing-widget": "Widget missing",
    unreachable: "Page unreachable",
    verified: "Widget verified",
    "wrong-tenant": "Wrong tenant"
  };

  return labels[status];
}

export function isWidgetInstallVerified(result: TenantWidgetInstallCheckResponse | null) {
  return result?.status === "verified";
}
