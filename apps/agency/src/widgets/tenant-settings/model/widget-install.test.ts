import { describe, expect, it } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { buildWidgetInstallPackage, buildWidgetSnippet } from "./widget-install";

describe("widget install model", () => {
  it("builds a copy-paste snippet bound to the tenant", () => {
    const install = buildWidgetInstallPackage(
      tenantFactory({
        slug: "pattaya-demo",
        widget: {
          aiName: "Mali",
          languages: ["en", "th"],
          welcomeMessage: "Sawadee, I can help with Pattaya condos.",
          welcomeMessages: {
            en: "Sawadee, I can help with Pattaya condos.",
            th: "สวัสดีค่ะ"
          }
        }
      })
    );

    expect(install.snippet).toContain('data-tenant="pattaya-demo"');
    expect(install.snippet).toContain('data-mode="starter"');
    expect(install.snippet).toContain('data-locale="auto"');
    expect(install.snippet).toContain('data-ai-name="Mali"');
    expect(install.snippet).toContain('data-languages="en,th"');
    expect(install.snippet).toContain("&quot;en&quot;:&quot;Sawadee");
    expect(install.steps.every((step) => step.done)).toBe(true);
  });

  it("escapes snippet attributes", () => {
    const snippet = buildWidgetSnippet({
      aiName: 'Anna "AI"',
      languageCodes: ["en", "ru"],
      mode: "growth",
      tenantSlug: "demo<script>",
      welcomeMessage: "Hi <buyer> & family",
      welcomeMessages: {
        en: "Hi <buyer> & family",
        ru: "Привет"
      }
    });

    expect(snippet).toContain('data-tenant="demo&lt;script&gt;"');
    expect(snippet).toContain('data-ai-name="Anna &quot;AI&quot;"');
    expect(snippet).toContain('data-welcome-message="Hi &lt;buyer&gt; &amp; family"');
  });

  it("keeps settings renderable for tenants loaded before widget fields exist", () => {
    const legacyTenant = tenantFactory();
    delete (legacyTenant as Partial<TenantSnapshot>).widget;

    const install = buildWidgetInstallPackage(legacyTenant);

    expect(install.snippet).toContain('data-ai-name="Anna"');
    expect(install.snippet).toContain('data-languages="en,ru,th,zh"');
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
    widget: {
      aiName: "Anna",
      languages: ["en", "ru", "th", "zh"],
      welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
      welcomeMessages: {
        en: "Hi! I'm Anna, your AI property consultant."
      }
    },
    ...overrides
  };
}
