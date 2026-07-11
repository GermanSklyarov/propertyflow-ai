export const queryKeys = {
  analytics: {
    all: ["analytics"] as const,
    dashboard: () => [...queryKeys.analytics.all, "dashboard"] as const
  },
  properties: {
    all: ["properties"] as const,
    detail: (propertyId: string) => [...queryKeys.properties.all, "detail", propertyId] as const,
    featured: (params?: Record<string, unknown>) => [...queryKeys.properties.all, "featured", params ?? {}] as const
  }
};
