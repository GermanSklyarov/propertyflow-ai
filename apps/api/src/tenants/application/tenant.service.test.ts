import { NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";
import type { TenantRepository } from "../domain/tenant.repository.js";
import { TenantService } from "./tenant.service.js";

describe("TenantService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
              allowedOrigins: [],
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
      allowedOriginsConfigured: false,
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
      readiness: {
        checks: [
          {
            key: "origin-policy",
            label: "Origin policy",
            note: "No origin allowlist is configured yet, so the widget is still in test mode.",
            ready: false
          },
          {
            key: "languages",
            label: "Languages",
            note: "2 locales enabled for the launcher.",
            ready: true
          },
          {
            key: "localized-welcome",
            label: "Localized welcome",
            note: "Every enabled language has a welcome message.",
            ready: true
          }
        ],
        nextAction: "Add production website origins before sharing the widget with live visitors.",
        status: "test-mode"
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

  it("marks public widget config ready when production origins and localized welcomes are configured", async () => {
    const service = new TenantService(
      repository({
        findBySlug: async () =>
          tenant({
            widget: {
              aiName: "Mali",
              aiNames: {
                en: "Mali",
                th: "มาลี"
              },
              allowedOrigins: ["https://agency.example.com"],
              languages: ["en", "th"],
              personaGenders: {
                en: "feminine",
                th: "feminine"
              },
              tone: "friendly",
              welcomeMessage: "Hi! I'm Mali.",
              welcomeMessages: {
                en: "Hi! I'm Mali.",
                th: "สวัสดีค่ะ ฉันชื่อมาลี"
              }
            }
          })
      })
    );

    await expect(service.getPublicWidgetConfig("demo-agency")).resolves.toMatchObject({
      readiness: {
        nextAction: "Widget configuration is ready for production installation.",
        status: "ready"
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

  it("enforces widget origin allowlist when configured", () => {
    const service = new TenantService(repository());
    const openTenant = tenant();
    const lockedTenant = tenant({
      widget: {
        ...tenant().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });

    expect(() => service.assertPublicWidgetOriginAllowed(openTenant, "https://unknown.example.com")).not.toThrow();
    expect(() => service.assertPublicWidgetOriginAllowed(lockedTenant, "https://agency.example.com")).not.toThrow();
    expect(() =>
      service.assertPublicWidgetOriginAllowed(lockedTenant, undefined, "https://agency.example.com/listings/1")
    ).not.toThrow();
    expect(() => service.assertPublicWidgetOriginAllowed(lockedTenant, "https://evil.example.com")).toThrow(
      "Widget origin is not allowed for this tenant"
    );
  });

  it("records public widget ask usage", async () => {
    const recorded: Array<{ tenantId: string; metadata?: Record<string, unknown> }> = [];
    const service = new TenantService(
      repository({
        recordUsage: async (tenantId, _eventType, metadata) => {
          recorded.push({ tenantId, metadata });
        }
      })
    );

    await service.recordPublicWidgetAsk(tenant({ id: "tenant-widget" }), { locale: "en" });

    expect(recorded).toEqual([{ metadata: { locale: "en" }, tenantId: "tenant-widget" }]);
  });

  it("verifies an installed widget script for the current tenant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => '<script src="https://cdn.propertyflow.ai/widget.js" data-tenant="demo-agency"></script>'
      }))
    );
    const service = new TenantService(repository());

    await expect(service.verifyWidgetInstall(tenant(), "https://agency.example.com/listings")).resolves.toMatchObject({
      allowedOrigin: true,
      checks: [
        { key: "origin", status: "passed" },
        { key: "page", status: "passed" },
        { key: "script", status: "passed" },
        { key: "tenant", status: "passed" }
      ],
      detectedTenantSlug: "demo-agency",
      expectedTenantSlug: "demo-agency",
      nextAction: "Open the page and confirm the launcher appears in each enabled language.",
      origin: "https://agency.example.com",
      status: "verified",
      url: "https://agency.example.com/listings"
    });
  });

  it("blocks widget install checks for origins outside the tenant allowlist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = new TenantService(repository());

    await expect(
      service.verifyWidgetInstall(
        tenant({
          widget: {
            ...tenant().widget,
            allowedOrigins: ["https://agency.example.com"]
          }
        }),
        "https://preview.example.com"
      )
    ).resolves.toMatchObject({
      allowedOrigin: false,
      checks: [
        { key: "origin", status: "failed" },
        { key: "page", status: "warning" },
        { key: "script", status: "warning" },
        { key: "tenant", status: "warning" }
      ],
      nextAction: "Add this origin in Widget website origins, then run the check again.",
      origin: "https://preview.example.com",
      status: "blocked-origin"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a widget script installed for another tenant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => '<script src="/widget.js" data-tenant="other-agency"></script>'
      }))
    );
    const service = new TenantService(repository());

    await expect(service.verifyWidgetInstall(tenant(), "https://agency.example.com")).resolves.toMatchObject({
      detectedTenantSlug: "other-agency",
      expectedTenantSlug: "demo-agency",
      nextAction: "Replace the snippet with the current workspace snippet from this settings page.",
      status: "wrong-tenant"
    });
  });

  it("reports unreachable widget install pages without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    const service = new TenantService(repository());

    await expect(service.verifyWidgetInstall(tenant(), "https://agency.example.com/missing")).resolves.toMatchObject({
      checks: [
        { key: "origin", status: "passed" },
        { key: "page", status: "failed" },
        { key: "script", status: "warning" },
        { key: "tenant", status: "warning" }
      ],
      nextAction: "Use a public page URL that returns HTML, then run the check again.",
      origin: "https://agency.example.com",
      status: "unreachable"
    });
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
        allowedOrigins: [" HTTPS://Agency.Example.com/widget ", "https://agency.example.com/contact", "not a url"],
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
        allowedOrigins: ["https://agency.example.com"],
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
    recordUsage: async () => undefined,
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
        en: "Hi! I'm Anna, your AI property consultant.",
        ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
        th: "สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
        zh: "你好！我是 Anna，你的 AI 房产顾问。"
      }
    },
    ...overrides
  };
}
