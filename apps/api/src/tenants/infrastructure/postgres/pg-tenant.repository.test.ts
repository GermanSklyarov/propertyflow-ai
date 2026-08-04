import { describe, expect, it, vi } from "vitest";
import { getTenantPlanDefinition } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PgTenantRepository } from "./pg-tenant.repository.js";

describe("PgTenantRepository", () => {
  it("provisions a tenant with plan limits and widget defaults", async () => {
    const createdAt = new Date("2026-07-24T08:00:00.000Z");
    const query = vi.fn();
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({
      rows: [
        {
          branding_display_name: "Sunset Homes",
          branding_logo_url: null,
          branding_primary_color: null,
          created_at: createdAt,
          custom_domain: null,
          domain_status: "not-configured",
          id: "tenant-generated",
          limits: getTenantPlanDefinition("starter").limits,
          name: "Sunset Homes",
          primary_market: null,
          slug: "sunset-homes",
          status: "active",
          subscription_plan: "starter",
          updated_at: createdAt,
          widget_ai_name: "Anna",
          widget_ai_names: {
            en: "Anna",
            ru: "Анна",
            th: "มาลี",
            zh: "安娜"
          },
          widget_allowed_origins: ["https://sunset.example"],
          widget_languages: ["en", "ru", "th", "zh"],
          widget_persona_genders: {
            en: "feminine",
            ru: "feminine",
            th: "feminine",
            zh: "neutral"
          },
          widget_tone: "friendly",
          widget_welcome_message: "Hi! I'm Anna, your AI property consultant.",
          widget_welcome_messages: {
            en: "Hi! I'm Anna, your AI property consultant.",
            ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
            th: "สวัสดีค่ะ ฉันชื่อ มาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
            zh: "你好！我是安娜，你的 AI 房产顾问。"
          }
        }
      ]
    });
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] });
    const client = {
      query,
      release: vi.fn()
    };
    const pool = {
      connect: vi.fn(async () => client)
    } as unknown as Pool;
    const repository = new PgTenantRepository(pool);

    const tenant = await repository.provision({
      name: "Sunset Homes",
      ownerEmail: "owner@sunset.example",
      ownerName: "Workspace owner",
      ownerUserId: "manager-demo-1",
      slug: "sunset-homes",
      subscriptionPlan: "starter",
      website: "https://sunset.example"
    });

    expect(query).toHaveBeenNthCalledWith(1, "begin");
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("insert into tenants"), [
      expect.any(String),
      "Sunset Homes",
      "sunset-homes",
      "starter",
      getTenantPlanDefinition("starter").limits,
      "Sunset Homes",
      "Anna",
      {
        en: "Anna",
        ru: "Анна",
        th: "มาลี",
        zh: "安娜"
      },
      "Hi! I'm Anna, your AI property consultant.",
      {
        en: "Hi! I'm Anna, your AI property consultant.",
        ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
        th: "สวัสดีค่ะ ฉันชื่อ มาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
        zh: "你好！我是安娜，你的 AI 房产顾问。"
      },
      {
        en: "feminine",
        ru: "feminine",
        th: "feminine",
        zh: "neutral"
      },
      ["https://sunset.example"],
      "/listings/:propertyId",
      "friendly",
      ["en", "ru", "th", "zh"],
      expect.any(String)
    ]);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining("insert into tenant_users"), [
      "manager-demo-1",
      expect.any(String),
      "Workspace owner",
      "owner@sunset.example",
      expect.any(String)
    ]);
    expect(query).toHaveBeenNthCalledWith(4, "commit");
    expect(client.release).toHaveBeenCalledOnce();
    expect(tenant).toMatchObject({
      branding: {
        displayName: "Sunset Homes"
      },
      slug: "sunset-homes",
      subscriptionPlan: "starter",
      widget: {
        allowedOrigins: ["https://sunset.example"],
        welcomeMessages: {
          th: "สวัสดีค่ะ ฉันชื่อ มาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
          zh: "你好！我是安娜，你的 AI 房产顾问。"
        }
      }
    });
  });

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

  it("falls back to a safe listing URL template for legacy invalid tenant rows", async () => {
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
            limits: getTenantPlanDefinition("starter").limits,
            name: "Demo Starter",
            primary_market: "pattaya",
            slug: "demo-starter",
            status: "active",
            subscription_plan: "starter",
            updated_at: createdAt,
            widget_ai_name: "Anna",
            widget_ai_names: null,
            widget_allowed_origins: ["https://demo.example.com"],
            widget_languages: ["en"],
            widget_listing_url_template: "https://evil.example.com/listings/:propertyId",
            widget_persona_genders: null,
            widget_tone: null,
            widget_welcome_message: "Hi! I'm Anna, your AI property consultant.",
            widget_welcome_messages: null
          }
        ]
      })
    } as unknown as Pool;
    const repository = new PgTenantRepository(pool);

    const tenant = await repository.findById("starter-tenant");

    expect(tenant?.widget.listingUrlTemplate).toBe("/listings/:propertyId");
  });
});
