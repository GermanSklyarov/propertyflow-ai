import type { TenantSnapshot } from "@propertyflow/contracts";
import { describe, expect, it } from "vitest";
import { buildWidgetDemoProfiles, buildWidgetDemoPrompts, buildWidgetDemoSummary, getPrimaryWidgetDemoProfile } from "./widget-demo";

const tenant = {
  branding: {
    displayName: "Demo Agency"
  },
  createdAt: "2026-07-28T00:00:00.000Z",
  domainStatus: "not-configured",
  id: "tenant-1",
  limits: {
    agents: 1,
    aiCreditsMonthly: 1000,
    properties: 100,
    publicApiRequestsMonthly: 10000
  },
  name: "Demo Agency",
  slug: "demo-agency",
  status: "active",
  subscriptionPlan: "starter",
  updatedAt: "2026-07-28T00:00:00.000Z",
  widget: {
    aiName: "Anna",
    aiNames: {
      en: "Anna",
      ru: "Анна"
    },
    allowedOrigins: [],
    languages: ["en", "ru"],
    personaGenders: {
      en: "feminine",
      ru: "feminine"
    },
    tone: "friendly",
    welcomeMessage: "Hi! I'm Anna.",
    welcomeMessages: {
      en: "Hi! I'm Anna.",
      ru: "Привет! Я Анна."
    }
  }
} as TenantSnapshot;

describe("widget demo model", () => {
  it("builds one demo profile per enabled widget language", () => {
    expect(buildWidgetDemoProfiles(tenant)).toEqual([
      {
        aiName: "Anna",
        locale: "en",
        localeLabel: "English",
        welcomeMessage: "Hi! I'm Anna."
      },
      {
        aiName: "Анна",
        locale: "ru",
        localeLabel: "Русский",
        welcomeMessage: "Привет! Я Анна."
      }
    ]);
  });

  it("uses localized prompt messages for live checks", () => {
    const prompts = buildWidgetDemoPrompts(tenant);

    expect(prompts).toHaveLength(2);
    expect(prompts[0]?.message).toContain("Pattaya");
    expect(prompts[1]?.message).toContain("Паттайе");
  });

  it("summarizes internal demo host origin mode", () => {
    expect(buildWidgetDemoSummary(tenant)).toEqual({
      originMode: "test",
      originNote: "No production origin is required for this internal demo host.",
      tenantSlug: "demo-agency"
    });
  });

  it("falls back to a safe primary profile", () => {
    expect(getPrimaryWidgetDemoProfile({ ...tenant, widget: { ...tenant.widget, languages: [] } }).locale).toBe("en");
  });
});
