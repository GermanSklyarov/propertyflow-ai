import type { ConciergeRequest, ConciergeResponse, PropertySearchResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { demoConciergeResponse, demoProperties } from "./demo-data";

const apiBaseUrl = process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

const demoHeaders = {
  "x-tenant-id": process.env.PROPERTYFLOW_TENANT_ID ?? "demo-agency",
  "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
  "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
};

export async function listFeaturedProperties(): Promise<PropertySnapshot[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties?limit=6`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoProperties;
    }

    const body = (await response.json()) as PropertySearchResponse;
    return body.items.length > 0 ? body.items.slice(0, 6) : demoProperties;
  } catch {
    return demoProperties;
  }
}

export async function askConcierge(request: ConciergeRequest): Promise<ConciergeResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/concierge/advise`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return demoConciergeResponse;
    }

    return (await response.json()) as ConciergeResponse;
  } catch {
    return demoConciergeResponse;
  }
}
