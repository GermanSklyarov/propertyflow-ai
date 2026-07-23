export function normalizeWidgetOrigin(value: string) {
  try {
    return new URL(value.trim()).origin.toLowerCase();
  } catch (_error) {
    return undefined;
  }
}

export function normalizeWidgetOrigins(origins: string[]) {
  return origins.reduce<string[]>((normalizedOrigins, origin) => {
    const normalizedOrigin = normalizeWidgetOrigin(origin);

    if (normalizedOrigin && !normalizedOrigins.includes(normalizedOrigin)) {
      normalizedOrigins.push(normalizedOrigin);
    }

    return normalizedOrigins;
  }, []);
}

export function buildCustomDomainOriginSuggestion(customDomain?: string) {
  if (!customDomain?.trim()) {
    return undefined;
  }

  return normalizeWidgetOrigin(`https://${customDomain.trim()}`);
}
