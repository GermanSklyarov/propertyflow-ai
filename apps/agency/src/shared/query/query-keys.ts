export const queryKeys = {
  analytics: {
    all: ["analytics"] as const,
    dashboard: () => [...queryKeys.analytics.all, "dashboard"] as const
  },
  leads: {
    all: ["leads"] as const,
    list: (filters: object) => [...queryKeys.leads.all, "list", filters] as const,
    queueSummary: (filters: object) => [...queryKeys.leads.all, "queue-summary", filters] as const
  }
};
