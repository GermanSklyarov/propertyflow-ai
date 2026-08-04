import type { TenantSnapshot } from "@propertyflow/contracts";
import { describe, expect, it } from "vitest";
import {
  buildWidgetDemoProfiles,
  buildWidgetDemoPrompts,
  buildWidgetDemoRuntime,
  buildWidgetDemoSummary,
  getPrimaryWidgetDemoProfile
} from "./widget-demo";

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
    listingUrlTemplate: "/listings/:propertyId",
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

  it("builds local widget runtime defaults for the demo host", () => {
    expect(buildWidgetDemoRuntime()).toEqual({
      apiBaseUrl: "http://127.0.0.1:3001",
      scriptSrc: "/api/widget-runtime"
    });
    expect(buildWidgetDemoRuntime({ apiBaseUrl: "https://api.example.com", scriptSrc: "https://cdn.example.com/widget.js" })).toEqual({
      apiBaseUrl: "https://api.example.com",
      scriptSrc: "https://cdn.example.com/widget.js"
    });
  });

  it("falls back to a safe primary profile", () => {
    expect(getPrimaryWidgetDemoProfile({ ...tenant, widget: { ...tenant.widget, languages: [] } }).locale).toBe("en");
  });
});
