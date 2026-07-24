import { describe, expect, it, vi } from "vitest";
import { getTenantPlanDefinition } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PgTenantRepository } from "./pg-tenant.repository.js";

describe("PgTenantRepository", () => {
  it("fills incomplete tenant limits from the shared plan catalog", async () => {
    const createdAt = new Date("2026-07-24T08:00:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            branding_display_name: "Demo Starter",
            branding_logo_url: null,
            branding_primary_color: null,
            created_at: createdAt,
            custom_domain: null,
            domain_status: "not-configured",
            id: "starter-tenant",
            limits: {
              publicApiRequestsMonthly: 25_000
            },
            name: "Demo Starter",
            primary_market: "pattaya",
            slug: "demo-starter",
            status: "active",
            subscription_plan: "starter",
            updated_at: createdAt,
            widget_ai_name: "Anna",
            widget_ai_names: null,
            widget_allowed_origins: null,
            widget_languages: [],
            widget_persona_genders: null,
            widget_tone: null,
            widget_welcome_message: "Hi! I'm Anna, your AI property consultant.",
            widget_welcome_messages: null
          }
        ]
      })
    } as unknown as Pool;
    const repository = new PgTenantRepository(pool);
    const starterPlan = getTenantPlanDefinition("starter");

    const tenant = await repository.findById("starter-tenant");

    expect(tenant?.limits).toEqual({
      ...starterPlan.limits,
      publicApiRequestsMonthly: 25_000
    });
  });
});
