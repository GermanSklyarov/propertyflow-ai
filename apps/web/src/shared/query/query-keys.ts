export const queryKeys = {
  properties: {
    all: ["properties"] as const,
    detail: (propertyId: string) => [...queryKeys.properties.all, "detail", propertyId] as const,
    featured: () => [...queryKeys.properties.all, "featured"] as const
  }
};
