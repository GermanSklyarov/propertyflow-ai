export const queryKeys = {
  analytics: {
    all: ["analytics"] as const,
    dashboard: () => [...queryKeys.analytics.all, "dashboard"] as const
  },
  leads: {
    all: ["leads"] as const,
    list: (filters: object) => [...queryKeys.leads.all, "list", filters] as const,
    queueSummary: (filters: object) => [...queryKeys.leads.all, "queue-summary", filters] as const
  },
  listings: {
    all: ["listings"] as const,
    list: (filters: object) => [...queryKeys.listings.all, "list", filters] as const
  },
  savedSearches: {
    all: ["saved-searches"] as const,
    alertAnalytics: () => [...queryKeys.savedSearches.all, "alert-analytics"] as const,
    list: () => [...queryKeys.savedSearches.all, "list"] as const,
    opportunities: () => [...queryKeys.savedSearches.all, "opportunities"] as const
  },
  tenant: {
    all: ["tenant"] as const,
    current: () => [...queryKeys.tenant.all, "current"] as const,
    usage: () => [...queryKeys.tenant.all, "usage"] as const
  }
};
