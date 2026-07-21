import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AiChatResponse, LeadSnapshot, TenantSnapshot } from "@propertyflow/contracts";
import { LeadService } from "../../../leads/application/lead.service.js";
import { AiChatService } from "../../application/ai-chat.service.js";
import { TenantService } from "../../../tenants/application/tenant.service.js";
import { PublicWidgetChatController } from "./public-widget-chat.controller.js";

describe("PublicWidgetChatController", () => {
  it("asks RAG from the active tenant resolved by widget slug", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      slug: "demo-agency",
      widget: {
        ...tenantFactory().widget,
        languages: ["en", "ru"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(chatResponse())
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn()
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads);

    await expect(
      controller.ask(
        "demo-agency",
        {
          locale: "ru",
          message: "Квартира в Паттайе до 5 млн",
          market: "pattaya"
        },
        "https://agency.example.com"
      )
    ).resolves.toMatchObject({
      conciergeMode: "starter",
      locale: "ru",
      tenantSlug: "demo-agency"
    });

    expect(chat.ask).toHaveBeenCalledWith("tenant-rag", {
      locale: "ru",
      market: "pattaya",
      message: "Квартира в Паттайе до 5 млн"
    });
    expect(tenants.assertPublicWidgetOriginAllowed).toHaveBeenCalledWith(tenant, "https://agency.example.com", undefined);
    expect(tenants.recordPublicWidgetAsk).toHaveBeenCalledWith(tenant, {
      locale: "ru",
      origin: "https://agency.example.com",
      referer: null
    });
  });

  it("falls back to the first enabled tenant widget language", async () => {
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(
        tenantFactory({
          widget: {
            ...tenantFactory().widget,
            languages: ["ru"]
          }
        })
      ),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(chatResponse())
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn()
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads);

    const response = await controller.ask("demo-agency", {
      locale: "zh",
      message: "海景公寓"
    });

    expect(response.locale).toBe("ru");
    expect(chat.ask).toHaveBeenCalledWith("tenant-1", {
      locale: "ru",
      message: "海景公寓"
    });
  });

  it("creates a tenant-scoped lead from public widget handoff", async () => {
    const tenant = tenantFactory({
      id: "tenant-handoff",
      slug: "demo-agency",
      widget: {
        ...tenantFactory().widget,
        languages: ["en", "ru"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn()
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ id: "lead-widget-1", tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads);

    await expect(
      controller.createLead(
        "demo-agency",
        {
          contactEmail: "buyer@example.com",
          contactName: " Buyer ",
          locale: "ru",
          message: "I want a viewing next week."
        },
        "https://agency.example.com",
        "https://agency.example.com/listing"
      )
    ).resolves.toMatchObject({
      conciergeMode: "starter",
      leadId: "lead-widget-1",
      locale: "ru",
      status: "new",
      tenantSlug: "demo-agency"
    });

    expect(tenants.assertPublicWidgetOriginAllowed).toHaveBeenCalledWith(
      tenant,
      "https://agency.example.com",
      "https://agency.example.com/listing"
    );
    expect(leads.create).toHaveBeenCalledWith("tenant-handoff", {
      contactEmail: "buyer@example.com",
      contactName: "Buyer",
      contactPhone: undefined,
      message: "I want a viewing next week.",
      preferredLocale: "ru",
      source: "ai-concierge"
    });
  });

  it("rejects widget handoff without email or phone", async () => {
    const tenant = tenantFactory();
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn()
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn()
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads);

    await expect(
      controller.createLead("demo-agency", {
        contactName: "Buyer",
        locale: "en",
        message: "Please contact me."
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(leads.create).not.toHaveBeenCalled();
  });
});

function chatResponse(overrides: Partial<AiChatResponse> = {}): AiChatResponse {
  return {
    answer: "I found matching listings from this tenant workspace.",
    citations: [],
    createdAt: "2026-07-21T00:00:00.000Z",
    id: "chat-1",
    matchedPropertyIds: [],
    message: "Question",
    suggestedActions: [],
    ...overrides
  };
}

function leadFactory(overrides: Partial<LeadSnapshot> = {}): LeadSnapshot {
  return {
    contactEmail: "buyer@example.com",
    contactName: "Buyer",
    createdAt: "2026-07-21T00:00:00.000Z",
    id: "lead-1",
    message: "Please contact me.",
    source: "ai-concierge",
    status: "new",
    tenantId: "tenant-1",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}

function tenantFactory(overrides: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Demo Agency",
      primaryColor: "#0f766e"
    },
    createdAt: "2026-07-20T00:00:00.000Z",
    domainStatus: "not-configured",
    id: "tenant-1",
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
        ru: "Анна"
      },
      allowedOrigins: [],
      languages: ["en", "ru"],
      personaGenders: {
        en: "feminine",
        ru: "feminine"
      },
      tone: "friendly",
      welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
      welcomeMessages: {
        en: "Hi! I'm Anna, your AI property consultant.",
        ru: "Привет! Я Анна, ваш AI-консультант по недвижимости."
      }
    },
    ...overrides
  };
}
