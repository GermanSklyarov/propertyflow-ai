export const queryKeys = {
  properties: {
    all: ["properties"] as const,
    detail: (propertyId: string) => [...queryKeys.properties.all, "detail", propertyId] as const,
    featured: (params?: Record<string, unknown>) => [...queryKeys.properties.all, "featured", params ?? {}] as const
  }
};
