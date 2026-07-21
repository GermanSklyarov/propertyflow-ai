import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";
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
            subscriptionPlan: "starter",
            widget: {
              aiName: "Nadia",
              aiNames: {
                en: "Nadia",
                ru: "Надя"
              },
              languages: ["en", "ru"],
              personaGenders: {
                en: "feminine",
                ru: "feminine"
              },
              tone: "professional",
              welcomeMessage: "Hi, I can help with Pattaya property.",
              welcomeMessages: {
                en: "Hi, I can help with Pattaya property.",
                ru: "Привет, помогу с недвижимостью в Паттайе."
              }
            }
          })
      })
    );

    await expect(service.getPublicWidgetConfig("riviera-pattaya")).resolves.toEqual({
      aiName: "Nadia",
      aiNames: {
        en: "Nadia",
        ru: "Надя"
      },
      branding: {
        displayName: "Riviera Pattaya",
        logoUrl: "https://cdn.example.com/logo.png",
        primaryColor: "#0f766e"
      },
      conciergeMode: "starter",
      languages: ["en", "ru"],
      personaGenders: {
        en: "feminine",
        ru: "feminine"
      },
      tenantSlug: "riviera-pattaya",
      tone: "professional",
      welcomeMessage: "Hi, I can help with Pattaya property.",
      welcomeMessages: {
        en: "Hi, I can help with Pattaya property.",
        ru: "Привет, помогу с недвижимостью в Паттайе."
      }
    });
  });

  it("hides missing or suspended tenants from public widget lookup", async () => {
    const missing = new TenantService(repository({ findBySlug: async () => null }));
    const suspended = new TenantService(repository({ findBySlug: async () => tenant({ status: "suspended" }) }));

    await expect(missing.getPublicWidgetConfig("missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(suspended.getPublicWidgetConfig("demo-agency")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("resolves only active tenants for public widget runtime endpoints", async () => {
    const active = new TenantService(repository({ findBySlug: async () => tenant({ id: "tenant-active", slug: "active-agency" }) }));
    const suspended = new TenantService(repository({ findBySlug: async () => tenant({ status: "suspended" }) }));

    await expect(active.getActiveTenantBySlugOrThrow("active-agency")).resolves.toMatchObject({
      id: "tenant-active",
      slug: "active-agency"
    });
    await expect(suspended.getActiveTenantBySlugOrThrow("demo-agency")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("normalizes widget language updates before saving settings", async () => {
    let capturedRequest: UpdateTenantSettingsRequest | undefined;
    const service = new TenantService(
      repository({
        updateSettings: async (_tenantId, request) => {
          capturedRequest = request;

          return tenant();
        }
      })
    );

    await service.updateSettings("demo-agency", {
      widget: {
        aiName: " Anna ",
        aiNames: {
          en: " Anna ",
          ru: " Анна ",
          zh: ""
        },
        languages: [" EN ", "ru", "es", "en"] as NonNullable<
          UpdateTenantSettingsRequest["widget"]
        >["languages"],
        personaGenders: {
          en: "feminine",
          ru: "wizard" as never,
          zh: "neutral"
        },
        tone: "luxury",
        welcomeMessage: " Welcome ",
        welcomeMessages: {
          en: " Welcome ",
          ru: " Привет ",
          zh: ""
        }
      }
    });

    expect(capturedRequest).toEqual({
      widget: {
        aiName: "Anna",
        aiNames: {
          en: "Anna",
          ru: "Анна"
        },
        languages: ["en", "ru"],
        personaGenders: {
          en: "feminine",
          zh: "neutral"
        },
        tone: "luxury",
        welcomeMessage: "Welcome",
        welcomeMessages: {
          en: "Welcome",
          ru: "Привет"
        }
      }
    });
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
    widget: {
      aiName: "Anna",
      aiNames: {
        en: "Anna",
        ru: "Анна",
        th: "มาลี",
        zh: "安娜"
      },
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
        en: "Hi! I'm Anna, your AI property consultant.",
        ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
        th: "สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
        zh: "你好！我是 Anna，你的 AI 房产顾问。"
      }
    },
    ...overrides
  };
}
