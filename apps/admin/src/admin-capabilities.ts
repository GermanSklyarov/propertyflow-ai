import type {
  SuperAdminDashboardResponse,
  SuperAdminLimitAlert,
  SuperAdminMetricCard
} from "@propertyflow/contracts";

export const adminAiCapabilities = [
  "Concierge chat",
  "Listing search / ranking",
  "Lead qualification",
  "RAG / knowledge base",
  "Embeddings",
  "Listing description generation",
  "Future proactive agents"
];

export const superAdminSections = [
  "Overview",
  "Agencies",
  "Usage & Costs",
  "AI Usage",
  "Integrations",
  "System Health"
] as const;

export const starterPilotLimits = {
  aiRequestsMonthly: 10_000,
  conversationsMonthly: 2_000,
  mapsRequestsMonthly: 5_000
} as const;

export function formatAdminMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

export function formatAdminMetric(card: SuperAdminMetricCard): { month: string; today: string } {
  if (card.unit === "usd") {
    return {
      month: formatAdminMoney(card.month),
      today: formatAdminMoney(card.today)
    };
  }

  return {
    month: new Intl.NumberFormat("en-US").format(card.month),
    today: new Intl.NumberFormat("en-US").format(card.today)
  };
}

export function selectActionableLimitAlerts(dashboard: SuperAdminDashboardResponse): SuperAdminLimitAlert[] {
  return dashboard.limits.filter((alert) => alert.level !== "ok").sort((left, right) => {
    const levelRank = { critical: 2, ok: 0, warning: 1 } as const;

    return levelRank[right.level] - levelRank[left.level] || right.utilizationRate - left.utilizationRate;
  });
}
