import type { IndexedPropertySearchResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const tenantId = process.env.SMOKE_TENANT_ID ?? "demo-agency";
const userId = process.env.SMOKE_USER_ID ?? "smoke-runner";
const userRole = process.env.SMOKE_USER_ROLE ?? "admin";
const token = `smoke-${crypto.randomUUID().slice(0, 8)}`;

const headers = {
  "content-type": "application/json",
  "x-tenant-id": tenantId,
  "x-user-id": userId,
  "x-user-role": userRole
};

const propertyPayload = {
  title: `Smoke Beach Condo ${token}`,
  description: `Automated indexing smoke test listing with token ${token}, sea view, beach access, pool, gym, and fiber internet.`,
  kind: "condo",
  market: "pattaya",
  price: {
    amount: 3_200_000,
    currency: "THB"
  },
  location: {
    latitude: 12.934,
    longitude: 100.883
  },
  address: `Terminal 21 Pattaya smoke address ${token}`,
  bedrooms: 1,
  bathrooms: 1,
  areaSqm: 42,
  floor: 8,
  beachDistanceMeters: 450,
  monthlyRentEstimate: {
    amount: 18_000,
    currency: "THB"
  },
  maintenanceFeeMonthly: {
    amount: 1_800,
    currency: "THB"
  },
  amenities: ["pool", "gym", "sea-view", "fiber-internet"]
};

const property = await requestJson<PropertySnapshot>("/properties", {
  method: "POST",
  body: JSON.stringify(propertyPayload)
});

console.log(`[smoke:indexing] created property ${property.id}`);

const result = await waitForIndexedProperty(property.id);

console.log(
  `[smoke:indexing] found property ${property.id} in ${result.index} with ${result.total} total hit(s)`
);

async function waitForIndexedProperty(propertyId: string): Promise<IndexedPropertySearchResponse> {
  const timeoutMs = Number(process.env.SMOKE_INDEX_TIMEOUT_MS ?? 30_000);
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;

    const result = await requestJson<IndexedPropertySearchResponse>(
      `/properties/search-index?query=${encodeURIComponent(token)}&limit=10&requiredAmenities=pool,gym`,
      { method: "GET" }
    );

    if (result.items.some((item) => item.propertyId === propertyId)) {
      console.log(`[smoke:indexing] indexed after ${attempt} poll attempt(s)`);
      return result;
    }

    await sleep(1_000);
  }

  throw new Error(
    `Property ${propertyId} was not found in OpenSearch within ${timeoutMs}ms. Is @propertyflow/worker running?`
  );
}

async function requestJson<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}: ${body}`);
  }

  return JSON.parse(body) as TResponse;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
