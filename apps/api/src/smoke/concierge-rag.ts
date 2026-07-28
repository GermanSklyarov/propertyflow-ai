import type { PublicWidgetAskResponse, TenantWidgetLanguage } from "@propertyflow/contracts";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const tenantSlug = process.env.SMOKE_WIDGET_TENANT_SLUG ?? "demo-agency";
const locale = parseLocale(process.env.SMOKE_CONCIERGE_LOCALE ?? "en");
const message =
  process.env.SMOKE_CONCIERGE_MESSAGE ??
  "I need a sea-view condo in Pattaya under 5M THB. Explain why it fits and mention any risks.";
const expectedProvider = process.env.SMOKE_CONCIERGE_EXPECT_PROVIDER;
const expectLlm = process.env.SMOKE_CONCIERGE_EXPECT_LLM !== "false";

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
console.log(`[smoke:concierge] preview=${response.answer.slice(0, 220).replace(/\s+/g, " ")}...`);

async function requestJson<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json"
    }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}: ${body}`);
  }

  return JSON.parse(body) as TResponse;
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
