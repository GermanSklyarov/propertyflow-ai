import { describe, expect, it } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { buildWidgetInstallPackage, buildWidgetSnippet } from "./widget-install";

describe("widget install model", () => {
  it("builds a copy-paste snippet bound to the tenant", () => {
    const install = buildWidgetInstallPackage(tenantFactory({ slug: "pattaya-demo" }));

    expect(install.snippet).toContain('data-tenant="pattaya-demo"');
    expect(install.snippet).toContain('data-mode="starter"');
    expect(install.snippet).toContain('data-ai-name="Anna"');
    expect(install.snippet).toContain('data-languages="en,ru,th,zh"');
    expect(install.steps.every((step) => step.done)).toBe(true);
  });

  it("escapes snippet attributes", () => {
    const snippet = buildWidgetSnippet({
      aiName: 'Anna "AI"',
      languageCodes: ["en", "ru"],
      mode: "growth",
      tenantSlug: "demo<script>",
      welcomeMessage: "Hi <buyer> & family"
    });

    expect(snippet).toContain('data-tenant="demo&lt;script&gt;"');
    expect(snippet).toContain('data-ai-name="Anna &quot;AI&quot;"');
    expect(snippet).toContain('data-welcome-message="Hi &lt;buyer&gt; &amp; family"');
  });
});

function tenantFactory(overrides: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Pattaya Demo Realty",
      primaryColor: "#0f766e"
    },
    createdAt: "2026-07-20T00:00:00.000Z",
    domainStatus: "not-configured",
    id: "tenant-1",
    limits: {
      agents: 5,
      aiCreditsMonthly: 5000,
      properties: 500,
      publicApiRequestsMonthly: 10000
    },
    name: "Pattaya Demo Realty",
    slug: "demo-agency",
    status: "active",
    subscriptionPlan: "starter",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides
  };
}
