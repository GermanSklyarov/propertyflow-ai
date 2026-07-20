import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import type { TenantRepository } from "../domain/tenant.repository.js";
import { TenantService } from "./tenant.service.js";

describe("TenantService", () => {
  it("returns public widget config for an active tenant slug", async () => {
    const service = new TenantService(
      repository({
        findBySlug: async () =>
          tenant({
            branding: {
              displayName: "Riviera Pattaya",
              logoUrl: "https://cdn.example.com/logo.png",
              primaryColor: "#0f766e"
            },
            slug: "riviera-pattaya",
            subscriptionPlan: "starter"
          })
      })
    );

    await expect(service.getPublicWidgetConfig("riviera-pattaya")).resolves.toEqual({
      aiName: "Anna",
      branding: {
        displayName: "Riviera Pattaya",
        logoUrl: "https://cdn.example.com/logo.png",
        primaryColor: "#0f766e"
      },
      conciergeMode: "starter",
      languages: ["en", "ru", "th", "zh"],
      tenantSlug: "riviera-pattaya",
      welcomeMessage: "Hi! I'm Anna, your AI property consultant."
    });
  });

  it("hides missing or suspended tenants from public widget lookup", async () => {
    const missing = new TenantService(repository({ findBySlug: async () => null }));
    const suspended = new TenantService(repository({ findBySlug: async () => tenant({ status: "suspended" }) }));

    await expect(missing.getPublicWidgetConfig("missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(suspended.getPublicWidgetConfig("demo-agency")).rejects.toBeInstanceOf(NotFoundException);
  });
});

function repository(overrides: Partial<TenantRepository> = {}): TenantRepository {
  return {
    findById: async () => null,
    findBySlug: async () => null,
    getUsage: async () => ({
      agents: 0,
      aiCreditsMonthly: 0,
      properties: 0,
      publicApiRequestsMonthly: 0
    }),
    updateSettings: async () => null,
    ...overrides
  };
}

function tenant(overrides: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Demo Agency"
    },
    createdAt: "2026-07-20T00:00:00.000Z",
    domainStatus: "not-configured",
    id: "demo-agency",
    limits: {
      agents: 5,
      aiCreditsMonthly: 1000,
      properties: 100,
      publicApiRequestsMonthly: 10_000
    },
    name: "Demo Agency",
    slug: "demo-agency",
    status: "active",
    subscriptionPlan: "starter",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides
  };
}
