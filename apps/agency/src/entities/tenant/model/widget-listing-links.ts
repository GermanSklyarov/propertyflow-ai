export const defaultWidgetListingUrlTemplate = "/listings/:propertyId";

export function normalizeWidgetListingUrlTemplate(value: string | undefined): string | undefined {
  const template = value?.trim();

  if (!template || !template.startsWith("/") || template.startsWith("//") || !template.includes(":propertyId")) {
    return undefined;
  }

  return template.slice(0, 160);
}

export function isWidgetListingUrlTemplate(value: string | undefined): boolean {
  return Boolean(normalizeWidgetListingUrlTemplate(value));
}
