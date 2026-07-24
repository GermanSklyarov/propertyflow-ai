import { describe, expect, it } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import {
  buildWidgetInstallPackage,
  buildWidgetLaunchReadinessItems,
  buildWidgetRuntimeReadiness,
  buildWidgetSnippet,
  summarizeWidgetInstallSteps,
  summarizeWidgetLaunchReadiness
} from "./widget-install";

describe("widget install model", () => {
  it("builds a copy-paste snippet bound to the tenant", () => {
    const install = buildWidgetInstallPackage(
      tenantFactory({
        slug: "pattaya-demo",
        widget: {
          aiName: "Mali",
          aiNames: {
            en: "Mali",
            th: "มาลี"
          },
          allowedOrigins: ["https://pattaya-demo.example.com"],
          languages: ["en", "th"],
          personaGenders: {
            en: "feminine",
            th: "feminine"
          },
          tone: "friendly",
          welcomeMessage: "Sawadee, I can help with Pattaya condos.",
          welcomeMessages: {
            en: "Sawadee, I can help with Pattaya condos.",
            th: "สวัสดีค่ะ"
          }
        }
      })
    );

    expect(install.snippet).toContain('data-tenant="pattaya-demo"');
    expect(install.snippet).toContain('data-api-base="https://api.propertyflow.ai"');
    expect(install.snippet).toContain('data-mode="starter"');
    expect(install.snippet).toContain('data-locale="auto"');
    expect(install.snippet).toContain('data-ai-name="Mali"');
    expect(install.snippet).toContain("data-ai-names=");
    expect(install.snippet).toContain("data-persona-genders=");
    expect(install.snippet).toContain('data-tone="friendly"');
    expect(install.snippet).toContain('data-languages="en,th"');
    expect(install.snippet).toContain("&quot;en&quot;:&quot;Sawadee");
    expect(install.localeOptions).toMatchObject([
      {
        label: "Auto locale",
        note: "Reads the page language and uses EN as the fallback. Enabled: EN, TH.",
        value: 'data-locale="auto"'
      },
      {
        label: "EN page",
        note: "Use this on a dedicated localized page, or set the same locale from the agency site language switcher.",
        value: 'data-locale="en"'
      },
      {
        label: "TH page",
        note: "Use this on a dedicated localized page, or set the same locale from the agency site language switcher.",
        value: 'data-locale="th"'
      }
    ]);
    expect(install.localeOptions[1]?.snippet).toContain('data-locale="en"');
    expect(install.localeOptions[2]?.snippet).toContain('data-locale="th"');
    expect(install.readiness).toMatchObject({
      nextAction: "Widget configuration is ready for production installation.",
      status: "ready"
    });
    expect(install.steps.every((step) => step.done)).toBe(true);
  });

  it("escapes snippet attributes", () => {
    const snippet = buildWidgetSnippet({
      aiName: 'Anna "AI"',
      aiNames: {
        en: 'Anna "AI"',
        ru: "Анна"
      },
      allowedOrigins: [],
      languageCodes: ["en", "ru"],
      mode: "growth",
      personaGenders: {
        en: "feminine",
        ru: "feminine"
      },
      tone: "professional",
      tenantSlug: "demo<script>",
      welcomeMessage: "Hi <buyer> & family",
      welcomeMessages: {
        en: "Hi <buyer> & family",
        ru: "Привет"
      },
      capabilities: {
        knowledgeAnswers: true,
        leadCapture: true,
        propertySearch: true
      }
    });

    expect(snippet).toContain('data-tenant="demo&lt;script&gt;"');
    expect(snippet).toContain('data-ai-name="Anna &quot;AI&quot;"');
    expect(snippet).toContain('data-welcome-message="Hi &lt;buyer&gt; &amp; family"');
  });

  it("builds locale-specific snippets", () => {
    const install = buildWidgetInstallPackage(tenantFactory());
    const snippet = buildWidgetSnippet(install.config, { locale: "ru" });

    expect(snippet).toContain('data-locale="ru"');
  });

  it("keeps settings renderable for tenants loaded before widget fields exist", () => {
    const legacyTenant = tenantFactory();
    delete (legacyTenant as Partial<TenantSnapshot>).widget;

    const install = buildWidgetInstallPackage(legacyTenant);

    expect(install.snippet).toContain('data-ai-name="Anna"');
    expect(install.snippet).toContain('data-languages="en,ru,th,zh"');
  });

  it("marks widget runtime test-mode until production origins are configured", () => {
    const readiness = buildWidgetRuntimeReadiness({
      aiName: "Anna",
      aiNames: {
        en: "Anna"
      },
      allowedOrigins: [],
      capabilities: {
        knowledgeAnswers: true,
        leadCapture: false,
        propertySearch: true
      },
      languageCodes: ["en"],
      mode: "starter",
      personaGenders: {
        en: "feminine"
      },
      tenantSlug: "demo-agency",
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: {
        en: "Hi"
      }
    });

    expect(readiness.status).toBe("test-mode");
    expect(readiness.nextAction).toBe("Add production website origins before sharing the widget with live visitors.");
  });

  it("requires localized welcomes for every enabled language", () => {
    const readiness = buildWidgetRuntimeReadiness({
      aiName: "Anna",
      aiNames: {
        en: "Anna"
      },
      allowedOrigins: ["https://demo.example.com"],
      capabilities: {
        knowledgeAnswers: true,
        leadCapture: false,
        propertySearch: true
      },
      languageCodes: ["en", "ru"],
      mode: "starter",
      personaGenders: {
        en: "feminine",
        ru: "feminine"
      },
      tenantSlug: "demo-agency",
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: {
        en: "Hi"
      }
    });

    expect(readiness.status).toBe("needs-setup");
    expect(readiness.checks).toContainEqual({
      key: "localized-welcome",
      label: "Localized welcome",
      note: "Add a welcome message for every enabled language.",
      ready: false
    });
  });

  it("describes starter widget capabilities without CRM lead capture", () => {
    const install = buildWidgetInstallPackage(tenantFactory({ subscriptionPlan: "starter" }));

    expect(install.config.capabilities).toEqual({
      knowledgeAnswers: true,
      leadCapture: false,
      propertySearch: true
    });
    expect(install.capabilities).toContainEqual({
      enabled: false,
      label: "CRM lead capture",
      note: "Starter keeps visitor conversations as AI answers until Growth is enabled."
    });
  });

  it("enables CRM lead capture for growth widgets", () => {
    const install = buildWidgetInstallPackage(tenantFactory({ subscriptionPlan: "growth" }));

    expect(install.config.capabilities.leadCapture).toBe(true);
    expect(install.capabilities).toContainEqual({
      enabled: true,
      label: "CRM lead capture",
      note: "Growth and Enterprise handoff can create CRM leads."
    });
  });

  it("summarizes widget launch readiness from runtime and starter gates", () => {
    const install = buildWidgetInstallPackage(
      tenantFactory({
        widget: {
          ...tenantFactory().widget,
          allowedOrigins: ["https://demo.example.com"],
          welcomeMessages: {
            en: "Hi",
            ru: "Привет",
            th: "สวัสดีค่ะ",
            zh: "你好"
          }
        }
      })
    );

    expect(
      summarizeWidgetLaunchReadiness({
        hasActiveKnowledgeJobs: false,
        hasLaunchReadyKnowledge: true,
        hasTenantSlug: true,
        runtimeReadiness: install.readiness
      })
    ).toEqual({ completed: 6, total: 6 });
  });

  it("keeps launch readiness blocked until starter knowledge is launch-ready", () => {
    const install = buildWidgetInstallPackage(
      tenantFactory({
        widget: {
          ...tenantFactory().widget,
          allowedOrigins: ["https://demo.example.com"],
          welcomeMessages: {
            en: "Hi",
            ru: "Привет",
            th: "สวัสดีค่ะ",
            zh: "你好"
          }
        }
      })
    );

    expect(
      summarizeWidgetLaunchReadiness({
        hasActiveKnowledgeJobs: false,
        hasLaunchReadyKnowledge: false,
        hasTenantSlug: true,
        runtimeReadiness: install.readiness
      })
    ).toEqual({ completed: 4, total: 6 });
  });

  it("keeps the indexing gate open while knowledge jobs run", () => {
    const install = buildWidgetInstallPackage(tenantFactory());

    expect(
      summarizeWidgetLaunchReadiness({
        hasActiveKnowledgeJobs: true,
        hasLaunchReadyKnowledge: true,
        hasTenantSlug: true,
        runtimeReadiness: install.readiness
      })
    ).toEqual({ completed: 4, total: 6 });
  });

  it("builds launch readiness cards from runtime and starter gates", () => {
    const install = buildWidgetInstallPackage(tenantFactory());

    expect(
      buildWidgetLaunchReadinessItems({
        hasActiveKnowledgeJobs: true,
        hasLaunchReadyKnowledge: true,
        hasTenantSlug: true,
        runtimeReadiness: install.readiness,
        starterSourceTypesReady: 3,
        tenantSlug: "demo-agency"
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionHref: "/knowledge#knowledge-jobs",
          actionLabel: "View jobs",
          done: false,
          label: "Indexing settled",
          note: "Wait for active ingestion jobs to finish."
        }),
        expect.objectContaining({
          actionHref: "#widget-origin-settings",
          actionLabel: "Add origins",
          done: false,
          label: "Origin policy"
        })
      ])
    );
  });

  it("links missing starter knowledge to the knowledge source form", () => {
    const install = buildWidgetInstallPackage(tenantFactory());

    expect(
      buildWidgetLaunchReadinessItems({
        hasActiveKnowledgeJobs: false,
        hasLaunchReadyKnowledge: false,
        hasTenantSlug: true,
        runtimeReadiness: install.readiness,
        starterSourceTypesReady: 0,
        tenantSlug: "demo-agency"
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionHref: "/knowledge?create=source#create-knowledge-document",
          actionLabel: "Add knowledge",
          done: false,
          label: "Knowledge available"
        })
      ])
    );
  });

  it("links missing localized welcome checks to the personality editor", () => {
    const readiness = buildWidgetRuntimeReadiness({
      aiName: "Anna",
      aiNames: {
        en: "Anna"
      },
      allowedOrigins: ["https://demo.example.com"],
      capabilities: {
        knowledgeAnswers: true,
        leadCapture: false,
        propertySearch: true
      },
      languageCodes: ["en", "ru"],
      mode: "starter",
      personaGenders: {
        en: "feminine",
        ru: "feminine"
      },
      tenantSlug: "demo-agency",
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: {
        en: "Hi"
      }
    });

    expect(
      buildWidgetLaunchReadinessItems({
        hasActiveKnowledgeJobs: false,
        hasLaunchReadyKnowledge: true,
        hasTenantSlug: true,
        runtimeReadiness: readiness,
        starterSourceTypesReady: 3,
        tenantSlug: "demo-agency"
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionHref: "#concierge-personality-settings",
          actionLabel: "Edit welcome",
          done: false,
          label: "Localized welcome"
        })
      ])
    );
  });

  it("summarizes install prerequisites", () => {
    expect(
      summarizeWidgetInstallSteps([
        { done: true, label: "Tenant key", note: "Ready" },
        { done: false, label: "Website origins", note: "Missing" }
      ])
    ).toEqual({ completed: 1, total: 2 });
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
      aiNames: {
        en: "Anna",
        ru: "Анна",
        th: "มาลี",
        zh: "安娜"
      },
      allowedOrigins: [],
      languages: ["en", "ru", "th", "zh"],
      personaGenders: {
        en: "feminine",
        ru: "feminine",
        th: "feminine",
        zh: "neutral"
      },
      tone: "friendly",
      welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
      welcomeMessages: {
        en: "Hi! I'm Anna, your AI property consultant."
      }
    },
    ...overrides
  };
}
