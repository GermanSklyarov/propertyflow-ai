export const queryKeys = {
  analytics: {
    all: ["analytics"] as const,
    dashboard: () => [...queryKeys.analytics.all, "dashboard"] as const
  },
  leads: {
    all: ["leads"] as const,
    detail: (leadId: string) => [...queryKeys.leads.all, "detail", leadId] as const,
    list: (filters: object) => [...queryKeys.leads.all, "list", filters] as const,
    notes: (leadId: string) => [...queryKeys.leads.all, "notes", leadId] as const,
    queueSummary: (filters: object) => [...queryKeys.leads.all, "queue-summary", filters] as const,
    timeline: (leadId: string) => [...queryKeys.leads.all, "timeline", leadId] as const
  },
  listings: {
    all: ["listings"] as const,
    aiAssets: (propertyId: string) => [...queryKeys.listings.all, "ai-assets", propertyId] as const,
    detail: (propertyId: string) => [...queryKeys.listings.all, "detail", propertyId] as const,
    images: (propertyId: string) => [...queryKeys.listings.all, "images", propertyId] as const,
    list: (filters: object) => [...queryKeys.listings.all, "list", filters] as const
  },
  jobs: {
    all: ["jobs"] as const,
    list: (filters: object) => [...queryKeys.jobs.all, "list", filters] as const
  },
  knowledge: {
    all: ["knowledge"] as const,
    list: (filters: object) => [...queryKeys.knowledge.all, "list", filters] as const
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
