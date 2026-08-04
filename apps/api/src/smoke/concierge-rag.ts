import type { PublicWidgetAskResponse, PublicWidgetConfigResponse, TenantWidgetLanguage } from "@propertyflow/contracts";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const tenantSlug = process.env.SMOKE_WIDGET_TENANT_SLUG ?? "demo-agency";
const locale = parseLocale(process.env.SMOKE_CONCIERGE_LOCALE ?? "en");
const widgetOrigin = normalizeOptionalUrl(process.env.SMOKE_WIDGET_ORIGIN ?? "http://localhost:3002");
const widgetReferer = process.env.SMOKE_WIDGET_REFERER ?? (widgetOrigin ? `${widgetOrigin}/propertyflow-widget-smoke` : undefined);
const message =
  process.env.SMOKE_CONCIERGE_MESSAGE ??
  "I need a sea-view condo in Pattaya under 5M THB. Explain why it fits and mention any risks.";
const expectedProvider = process.env.SMOKE_CONCIERGE_EXPECT_PROVIDER;
const expectLlm = process.env.SMOKE_CONCIERGE_EXPECT_LLM !== "false";

const config = await requestJson<PublicWidgetConfigResponse>(`/public/v1/widget/config/${tenantSlug}`, {
  method: "GET"
});

assert(config.tenantSlug === tenantSlug, `Expected config tenantSlug ${tenantSlug}, got ${config.tenantSlug}`);
assert(config.conciergeMode === "starter", `Expected Starter widget mode, got ${config.conciergeMode}`);
assert(config.capabilities.knowledgeAnswers, "Expected public widget knowledge answers to be enabled");
assert(config.capabilities.propertySearch, "Expected public widget property search to be enabled");
assert(config.languages.includes(locale), `Expected config languages to include ${locale}`);
assert(config.listingUrlTemplate.includes(":propertyId"), "Expected widget listing URL template to include :propertyId");
assert(config.readiness.checks.length > 0, "Expected widget readiness checks");
assert(
  config.readiness.status !== "needs-setup",
  `Widget config still needs setup before production smoke: ${config.readiness.nextAction}`
);

const response = await requestJson<PublicWidgetAskResponse>(`/public/v1/widget/ask/${tenantSlug}`, {
  method: "POST",
  body: JSON.stringify({
    locale,
    market: "pattaya",
    message,
    purpose: "investment"
  })
});

assert(response.tenantSlug === tenantSlug, `Expected tenantSlug ${tenantSlug}, got ${response.tenantSlug}`);
assert(response.locale === locale, `Expected locale ${locale}, got ${response.locale}`);
assert(response.answer.trim().length > 80, "Expected a substantive Concierge answer");
assert(response.matchedPropertyIds.length > 0, "Expected at least one matched property");
assert(response.recommendedListings.length > 0, "Expected at least one clickable recommended listing");
assert(
  response.recommendedListings.every((listing) => response.matchedPropertyIds.includes(listing.propertyId)),
  "Expected every recommended listing to come from matched property ids"
);
assert(
  response.recommendedListings.every((listing) => sameOrigin(listing.url, widgetOrigin)),
  `Expected recommended listing URLs to use widget origin ${widgetOrigin ?? "none"}`
);
assert(
  response.citations.some((citation) => citation.source === "property"),
  "Expected at least one property citation"
);
assert(
  response.citations.some((citation) => citation.source === "knowledge"),
  "Expected at least one knowledge citation. Run npm run seed:demo-knowledge and npm run seed:demo-embeddings first."
);

if (expectLlm) {
  assert(response.generation?.mode === "llm", `Expected LLM generation, got ${response.generation?.mode ?? "none"}`);
  assert(response.generation.provider !== undefined, "Expected LLM provider metadata");
  assert(response.generation.model !== undefined, "Expected LLM model metadata");
}

if (expectedProvider) {
  assert(
    response.generation?.provider === expectedProvider,
    `Expected provider ${expectedProvider}, got ${response.generation?.provider ?? "none"}`
  );
}

if (locale === "ru") {
  assert(!/\bя\s+(нашел|подобрал|проверил|рекомендовал)\b/i.test(response.answer), "Russian persona answered in masculine voice");
}

assert(!/\[\d+\]/.test(response.answer), "Answer should not print bracketed citation markers; citations belong in API metadata");

console.log("[smoke:concierge] OK");
console.log(`[smoke:concierge] tenant=${response.tenantSlug} locale=${response.locale}`);
console.log(
  `[smoke:concierge] config readiness=${config.readiness.status} origins=${
    config.allowedOriginsConfigured ? "configured" : "test-mode"
  }`
);
console.log(`[smoke:concierge] requestOrigin=${widgetOrigin ?? "none"}`);
console.log(
  `[smoke:concierge] generation=${response.generation?.mode ?? "none"} provider=${
    response.generation?.provider ?? "none"
  } model=${response.generation?.model ?? "none"}`
);
console.log(`[smoke:concierge] matchedProperties=${response.matchedPropertyIds.length}`);
console.log(
  `[smoke:concierge] citations property=${
    response.citations.filter((citation) => citation.source === "property").length
  } knowledge=${response.citations.filter((citation) => citation.source === "knowledge").length}`
);
console.log(
  `[smoke:concierge] recommendedListings=${response.recommendedListings.length} firstUrl=${
    response.recommendedListings[0]?.url ?? "none"
  }`
);
console.log(`[smoke:concierge] preview=${response.answer.slice(0, 220).replace(/\s+/g, " ")}...`);

async function requestJson<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: buildRequestHeaders()
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}: ${body}`);
  }

  return JSON.parse(body) as TResponse;
}

function buildRequestHeaders(): HeadersInit {
  return {
    ...(widgetOrigin ? { origin: widgetOrigin } : {}),
    ...(widgetReferer ? { referer: widgetReferer } : {}),
    "content-type": "application/json"
  };
}

function normalizeOptionalUrl(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/$/, "");
}

function sameOrigin(url: string, expectedOrigin: string | undefined): boolean {
  if (!expectedOrigin) {
    return false;
  }

  try {
    return new URL(url).origin.toLowerCase() === expectedOrigin;
  } catch (_error) {
    return false;
  }
}

function parseLocale(value: string): TenantWidgetLanguage {
  if (value === "en" || value === "ru" || value === "th" || value === "zh") {
    return value;
  }

  throw new Error(`Unsupported SMOKE_CONCIERGE_LOCALE=${value}. Use en, ru, th, or zh.`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[smoke:concierge] ${message}`);
  }
}
