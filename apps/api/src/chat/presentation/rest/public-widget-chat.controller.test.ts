import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AiChatResponse, LeadSnapshot, TenantSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { LeadService } from "../../../leads/application/lead.service.js";
import type { PropertyRepository } from "../../../properties/domain/property.repository.js";
import { AiChatService } from "../../application/ai-chat.service.js";
import type { PublicWidgetRateLimitService } from "../../application/public-widget-rate-limit.service.js";
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
    const properties = propertyRepository();
    const rateLimits = rateLimitService();
    const controller = new PublicWidgetChatController(tenants, chat, leads, properties, rateLimits);

    await expect(
      controller.ask(
        "demo-agency",
        {
          conversation: [
            { role: "user", text: "find me a condo in pattaya under 3m" },
            { role: "assistant", text: "I found condos in Central Pattaya under 3M." }
          ],
          locale: "ru",
          message: "Квартира в Паттайе до 5 млн",
          market: "pattaya",
          sessionId: "session-1"
        },
        requestFactory({ ip: "203.0.113.10" }),
        "https://agency.example.com"
      )
    ).resolves.toMatchObject({
      conciergeMode: "starter",
      locale: "ru",
      tenantSlug: "demo-agency"
    });

    expect(chat.ask).toHaveBeenCalledWith(
      "tenant-rag",
      {
        conversation: [
          { role: "user", text: "find me a condo in pattaya under 3m" },
          { role: "assistant", text: "I found condos in Central Pattaya under 3M." }
        ],
        locale: "ru",
        market: "pattaya",
        message: "Квартира в Паттайе до 5 млн"
      },
      {
        persona: {
          gender: "feminine",
          leadQualificationFields: ["budget", "preferredArea", "email", "phone"],
          name: "Анна",
          tone: "friendly",
          welcomeMessage: "Привет! Я Анна, ваш AI-консультант по недвижимости."
        }
      }
    );
    expect(tenants.assertPublicWidgetOriginAllowed).toHaveBeenCalledWith(tenant, "https://agency.example.com", undefined);
    expect(rateLimits.checkPublicWidgetAsk).toHaveBeenCalledWith({
      ip: "203.0.113.10",
      sessionId: "session-1",
      tenantId: "tenant-rag"
    });
    expect(tenants.recordPublicWidgetAsk).toHaveBeenCalledWith(tenant, {
      locale: "ru",
      origin: "https://agency.example.com",
      referer: null
    });
  });

  it("returns clickable recommended listing links for matched widget properties", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"],
        listingUrlTemplate: "/catalog/:propertyId"
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(chatResponse({ matchedPropertyIds: ["property-1", "missing-property"] }))
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn()
    } as unknown as LeadService;
    const properties = propertyRepository({
      findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
        propertyId === "property-1"
          ? Promise.resolve(propertyFactory({ id: "property-1", title: "Wongamat Sea View Residence" }))
          : Promise.resolve(null)
      )
    });
    const controller = new PublicWidgetChatController(tenants, chat, leads, properties, rateLimitService());

    await expect(
      controller.ask(
        "demo-agency",
        {
          locale: "en",
          message: "Show me sea view condos"
        },
        requestFactory(),
        "https://agency.example.com",
        "https://agency.example.com/listings"
      )
    ).resolves.toMatchObject({
      recommendedListings: [
        {
          propertyId: "property-1",
          title: "Wongamat Sea View Residence",
          url: "https://agency.example.com/catalog/property-1"
        }
      ]
    });
    expect(properties.findById).toHaveBeenCalledWith("tenant-rag", "property-1");
  });

  it("keeps public widget listing answers compact when cards already render the top matches", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 9 matching listings, and I'm happy to share the top 3 with you!\n\n1. **Wongamat Sea View Residence**",
          matchedPropertyIds: ["property-1"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn()
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      leads,
      propertyRepository({
        findById: vi.fn().mockResolvedValue(propertyFactory({
          amenities: ["pool", "walkable"],
          areaSqm: 42,
          bedrooms: 1,
          beachDistanceMeters: 650,
          id: "property-1",
          price: {
            amount: 2_850_000,
            currency: "THB"
          },
          title: "Wongamat Sea View Residence"
        }))
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "Show me sea view condos"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("I found 1 matching listing. Here is the top match I can show now.");
    expect(response.answer).toContain("2.9M THB");
    expect(response.answer).toContain("1 bedroom");
    expect(response.answer).toContain("42 sqm");
    expect(response.answer).toContain("650m from the beach");
    expect(response.answer).toContain("Wongamat Sea View Residence: 2.9M THB, 1 bedroom, 42 sqm layouts");
    expect(response.answer).not.toContain("**");
    expect(response.answer).not.toContain("1. Wongamat");
    expect(response.recommendedListings).toHaveLength(1);
  });

  it("does not ask for rental budget again when the refinement already includes it", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 7 matching listings.",
          matchedPropertyIds: ["property-1"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockResolvedValue(
          propertyFactory({
            amenities: ["pool", "washing machine"],
            areaSqm: 34,
            bedrooms: 0,
            id: "property-1",
            listingType: "rent",
            rentalPriceMonthly: { amount: 18_000, currency: "THB" },
            title: "Studio Condo at Club Royal - Naklua"
          })
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          { role: "user", text: "find me a cheap condo in pattaya" },
          { role: "assistant", text: "To narrow this down, tell me whether you want to rent or buy, your budget, preferred area or beach distance, and timing." }
        ],
        locale: "en",
        message: "i mean for rent, budget under 20k"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("18k THB/mo");
    expect(response.answer).not.toContain("monthly budget");
    expect(response.answer).toContain("preferred area or beach distance");
    expect(response.answer).toContain("move-in date and contract length");
  });

  it("returns a complete deterministic no-card answer for landmark searches with no public listings", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer:
            "I couldn't find any condos for rent directly close to Water Park Ramayana. Alternatively, I found a 1-",
          citations: [
            {
              label:
                'Rule-based interpreter extracted listingType=rent; market=pattaya. Map geocoding resolved "Ramayana Water Park" once and applied radiusMeters=3000 with geo filtering.',
              source: "search"
            }
          ],
          matchedPropertyIds: [],
          suggestedActions: ["relax-filters", "ask-agent-for-off-market-options"]
        })
      )
    } as unknown as AiChatService;
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository(),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo in Pattaya for rent close to Water Park Ramayana"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("I recognized Ramayana Water Park on the map");
    expect(response.answer).toContain("applied location filtering");
    expect(response.answer).toContain("within the current radius");
    expect(response.answer).not.toContain("Alternatively, I found a 1-");
    expect(response.recommendedListings).toEqual([]);
  });

  it("uses geocoded widget landmarks for card distances and ranking", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 2 matching listings.",
          matchedPropertyIds: ["far", "near"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "far",
        propertyFactory({
          id: "far",
          listingType: "rent",
          location: { latitude: 12.91, longitude: 100.88 },
          rentalPriceMonthly: { amount: 28_000, currency: "THB" },
          title: "Far Jomtien Rental Condo"
        })
      ],
      [
        "near",
        propertyFactory({
          id: "near",
          listingType: "rent",
          location: { latitude: 12.9705, longitude: 100.9901 },
          rentalPriceMonthly: { amount: 32_000, currency: "THB" },
          title: "Frost Area Rental Condo"
        })
      ]
    ]);
    const locationIntelligence = {
      resolveComparisonTarget: vi.fn().mockResolvedValue({
        kind: "poi",
        poi: {
          aliases: ["Frost Magical Ice of Siam"],
          category: "landmark",
          id: "geocoded-frost-magical-ice-of-siam",
          label: "Frost Magical Ice of Siam",
          location: { latitude: 12.9706, longitude: 100.9902 },
          market: "pattaya"
        }
      })
    };
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService(),
      locationIntelligence as never
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo in Pattaya for rent close to Frost Magical Ice of Siam"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Frost Area Rental Condo",
      "Far Jomtien Rental Condo"
    ]);
    expect(response.answer).toContain("from Frost Magical Ice of Siam");
    expect(response.answer.indexOf("Frost Area Rental Condo:")).toBeLessThan(response.answer.indexOf("Far Jomtien Rental Condo:"));
  });

  it("does not infer family living from Russian увидеть in winter-stay landmark requests", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 2 matching listings.",
          matchedPropertyIds: ["large", "compact"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "large",
        propertyFactory({
          areaSqm: 198.6,
          bedrooms: 4,
          id: "large",
          kind: "townhouse",
          listingType: "rent",
          rentalPriceMonthly: { amount: 68_000, currency: "THB" },
          title: "4BR Townhouse at Siam Oriental Tropical Garden - Pratumnak"
        })
      ],
      [
        "compact",
        propertyFactory({
          areaSqm: 34,
          bedrooms: 1,
          id: "compact",
          listingType: "rent",
          rentalPriceMonthly: { amount: 24_000, currency: "THB" },
          title: "1BR Condo near Frost Magical Ice of Siam"
        })
      ]
    ]);
    const locationIntelligence = {
      resolveComparisonTarget: vi.fn().mockResolvedValue({
        kind: "poi",
        poi: {
          aliases: ["Frost Magical Ice of Siam"],
          category: "landmark",
          id: "geocoded-frost-magical-ice-of-siam",
          label: "Frost Magical Ice of Siam",
          location: { latitude: 12.9706, longitude: 100.9902 },
          market: "pattaya"
        }
      })
    };
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService(),
      locationIntelligence as never
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "ru",
        message:
          "Я хочу приехать на зимовку в Паттайю в ноябре, но иногда хочется увидеть снег, подбери квартиру в аренду недалеко от Frost Magical Ice of Siam"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual(["1BR Condo near Frost Magical Ice of Siam"]);
    expect(response.answer).not.toContain("Для проживания с детьми");
    expect(response.answer).toContain("от Frost Magical Ice of Siam");
    expect(response.answer).not.toContain("4BR Townhouse");
  });

  it("keeps Russian seven-day move-in timing and apartment rental intent out of family-sized cards", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["townhouse", "rental-condo", "sale-condo"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "townhouse",
        propertyFactory({
          areaSqm: 198.6,
          bedrooms: 4,
          id: "townhouse",
          kind: "townhouse",
          listingType: "rent",
          rentalPriceMonthly: { amount: 68_000, currency: "THB" },
          title: "4BR Townhouse at Siam Oriental Tropical Garden - Pratumnak"
        })
      ],
      [
        "rental-condo",
        propertyFactory({
          areaSqm: 45,
          bedrooms: 1,
          id: "rental-condo",
          kind: "condo",
          listingType: "rent",
          location: { latitude: 12.931, longitude: 100.878 },
          rentalPriceMonthly: { amount: 24_000, currency: "THB" },
          title: "Central Pattaya Rental Loft"
        })
      ],
      [
        "sale-condo",
        propertyFactory({
          areaSqm: 38,
          bedrooms: 1,
          id: "sale-condo",
          kind: "condo",
          listingType: "sale",
          price: { amount: 3_000_000, currency: "THB" },
          title: "Pratumnak Investment One-Bed"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "ru",
        message: "подбери мне какую-нибудь квартиру в паттайе в аренду рядом с волкинг стрит, въезжаю через семь дней"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual(["Central Pattaya Rental Loft"]);
    expect(response.answer).toContain("24k THB/mo");
    expect(response.answer).not.toContain("Для проживания с детьми");
    expect(response.answer).not.toContain("дату въезда");
    expect(response.answer).not.toContain("4BR Townhouse");
    expect(response.answer).not.toContain("Pratumnak Investment One-Bed");
  });

  it("uses curated Asia Pattaya Hotel distances instead of falling back to generic Pattaya search", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 2 matching listings.",
          matchedPropertyIds: ["north", "asia-near"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "north",
        propertyFactory({
          id: "north",
          location: { latitude: 12.95, longitude: 100.889 },
          title: "1BR Condo at Once Pattaya - North Pattaya"
        })
      ],
      [
        "asia-near",
        propertyFactory({
          id: "asia-near",
          location: { latitude: 12.916, longitude: 100.86 },
          title: "1BR Condo near Asia Pattaya Hotel"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo next to Asia Pattaya Hotel"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "1BR Condo near Asia Pattaya Hotel",
      "1BR Condo at Once Pattaya - North Pattaya"
    ]);
    expect(response.answer).toContain("from Asia Pattaya Hotel");
    expect(response.answer).not.toContain("closest option about 2537m from the beach, amenities");
  });

  it("explains why rentals fit a Central Pattaya location request with target distances", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["city-garden", "the-cliff", "grand-avenue"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "city-garden",
        propertyFactory({
          areaSqm: 31.6,
          beachDistanceMeters: 281,
          id: "city-garden",
          listingType: "rent",
          location: { latitude: 12.925, longitude: 100.871 },
          rentalPriceMonthly: { amount: 25_000, currency: "THB" },
          title: "1BR Condo at City Garden Pratumnak - Pratumnak"
        })
      ],
      [
        "the-cliff",
        propertyFactory({
          areaSqm: 29.8,
          beachDistanceMeters: 707,
          id: "the-cliff",
          listingType: "rent",
          location: { latitude: 12.916, longitude: 100.86 },
          rentalPriceMonthly: { amount: 24_000, currency: "THB" },
          title: "1BR Condo at The Cliff - Pratumnak"
        })
      ],
      [
        "grand-avenue",
        propertyFactory({
          areaSqm: 41.9,
          beachDistanceMeters: 1049,
          id: "grand-avenue",
          listingType: "rent",
          location: { latitude: 12.9308, longitude: 100.8831 },
          rentalPriceMonthly: { amount: 30_000, currency: "THB" },
          title: "1BR Condo at Grand Avenue Residence - Central Pattaya"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo for rent near central pattaya"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("area: Central Pattaya");
    expect(response.answer).toContain("These condo options fit the Pattaya search because they include");
    expect(response.answer).toContain("closest option about");
    expect(response.answer).toContain("1BR Condo at Grand Avenue Residence - Central Pattaya: 30k THB/mo");
    expect(response.answer).toContain("in or near Central Pattaya, closest option about 1049m from the beach");
    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "1BR Condo at Grand Avenue Residence - Central Pattaya"
    ]);
    expect(response.answer).not.toContain("1BR Condo at City Garden Pratumnak - Pratumnak:");
  });

  it("filters public cards by studio or 1 bedroom refinements instead of showing next broad matches", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 8 matching listings.",
          matchedPropertyIds: ["grand-avenue-2br", "grand-avenue-1br", "base-studio"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "grand-avenue-2br",
        propertyFactory({
          areaSqm: 60.6,
          bedrooms: 2,
          id: "grand-avenue-2br",
          listingType: "rent",
          location: { latitude: 12.9308, longitude: 100.8831 },
          rentalPriceMonthly: { amount: 32_000, currency: "THB" },
          title: "2BR Condo at Grand Avenue Residence - Central Pattaya"
        })
      ],
      [
        "grand-avenue-1br",
        propertyFactory({
          areaSqm: 41.9,
          bedrooms: 1,
          id: "grand-avenue-1br",
          listingType: "rent",
          location: { latitude: 12.9308, longitude: 100.8831 },
          rentalPriceMonthly: { amount: 30_000, currency: "THB" },
          title: "1BR Condo at Grand Avenue Residence - Central Pattaya"
        })
      ],
      [
        "base-studio",
        propertyFactory({
          areaSqm: 33,
          bedrooms: 0,
          id: "base-studio",
          listingType: "rent",
          location: { latitude: 12.94, longitude: 100.89 },
          rentalPriceMonthly: { amount: 22_000, currency: "THB" },
          title: "Studio Condo at The Base Central Pattaya"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          { role: "user", text: "find me a condo for rent near central pattaya" },
          { role: "assistant", text: "I found rentals near Central Pattaya." }
        ],
        locale: "en",
        message: "show me only 1 bedroom or studio"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "1BR Condo at Grand Avenue Residence - Central Pattaya",
      "Studio Condo at The Base Central Pattaya"
    ]);
    expect(response.answer).toContain("studio-1 bedrooms");
    expect(response.answer).not.toContain("2BR Condo at Grand Avenue Residence");
  });

  it("keeps Russian Pratumnak context when the visitor refines rent, budget, and move-in timing", async () => {
    const controller = publicWidgetControllerForProperties(
      ["huai-yai", "the-cliff", "naklua", "pratumnak-studio"],
      new Map([
        [
          "huai-yai",
          propertyFactory({
            amenities: ["kids playground", "balcony", "washing machine"],
            areaSqm: 31.9,
            bedrooms: 0,
            id: "huai-yai",
            listingType: "rent",
            location: { latitude: 12.8401, longitude: 100.9401 },
            rentalPriceMonthly: { amount: 14_000, currency: "THB" },
            title: "Studio Condo at Huai Yai Villas - Huai Yai"
          })
        ],
        [
          "the-cliff",
          propertyFactory({
            amenities: ["key card access", "European kitchen", "washing machine"],
            areaSqm: 29.8,
            bedrooms: 1,
            id: "the-cliff",
            listingType: "rent",
            location: { latitude: 12.916, longitude: 100.86 },
            rentalPriceMonthly: { amount: 18_000, currency: "THB" },
            title: "1BR Condo at The Cliff - Pratumnak"
          })
        ],
        [
          "naklua",
          propertyFactory({
            amenities: ["covered parking", "garden", "communal pool"],
            areaSqm: 36.8,
            bedrooms: 0,
            id: "naklua",
            listingType: "rent",
            location: { latitude: 12.9706, longitude: 100.9902 },
            rentalPriceMonthly: { amount: 18_000, currency: "THB" },
            title: "Studio Condo at Club Royal - Naklua"
          })
        ],
        [
          "pratumnak-studio",
          propertyFactory({
            amenities: ["fiber-internet", "pool", "coworking-lounge"],
            areaSqm: 31,
            bedrooms: 0,
            id: "pratumnak-studio",
            listingType: "rent",
            location: { latitude: 12.914, longitude: 100.861 },
            rentalPriceMonthly: { amount: 19_000, currency: "THB" },
            title: "Terminal 21 Walkable Studio - Pratumnak"
          })
        ]
      ])
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          { role: "user", text: "я ищу недорогую студию или однушку в паттайе на пратамнаке, что посоветуешь?" },
          { role: "assistant", text: "Я нашла варианты на Пратамнаке." }
        ],
        locale: "ru",
        market: "pattaya",
        message: "меня интересует аренда, бюджет до 20 тысяч, планирую въехать в конце ноября, контракт на полгода"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "1BR Condo at The Cliff - Pratumnak",
      "Terminal 21 Walkable Studio - Pratumnak"
    ]);
    expect(response.answer).toContain("Pratumnak");
    expect(response.answer).toContain("район: Pratumnak");
    expect(response.answer).toContain("в районе Pratumnak");
    expect(response.answer).toContain("студия и 1 спальня");
    expect(response.answer).toContain("удобства:");
    expect(response.answer).toContain("стиральная машина");
    expect(response.answer).not.toContain("от Pratumnak");
    expect(response.answer).not.toContain("amenities like");
    expect(response.answer).not.toContain("studio спальн.");
    expect(response.answer).not.toContain("Naklua");
    expect(response.answer).not.toContain("Huai Yai");
  });

  it("uses the latest mentioned Pattaya area when a Russian visitor changes location", async () => {
    const controller = publicWidgetControllerForProperties(
      ["pratumnak-studio", "jomtien-studio", "jomtien-2br"],
      new Map([
        [
          "pratumnak-studio",
          propertyFactory({
            bedrooms: 0,
            id: "pratumnak-studio",
            listingType: "rent",
            location: { latitude: 12.914, longitude: 100.861 },
            rentalPriceMonthly: { amount: 19_000, currency: "THB" },
            title: "Studio Condo at Pratumnak"
          })
        ],
        [
          "jomtien-studio",
          propertyFactory({
            amenities: ["pool", "washing machine"],
            bedrooms: 0,
            id: "jomtien-studio",
            listingType: "rent",
            location: { latitude: 12.897, longitude: 100.875 },
            rentalPriceMonthly: { amount: 18_000, currency: "THB" },
            title: "Studio Condo at Jomtien Beach - Jomtien"
          })
        ],
        [
          "jomtien-2br",
          propertyFactory({
            bedrooms: 2,
            id: "jomtien-2br",
            listingType: "rent",
            location: { latitude: 12.896, longitude: 100.874 },
            rentalPriceMonthly: { amount: 28_000, currency: "THB" },
            title: "2BR Condo at Jomtien Complex - Jomtien"
          })
        ]
      ])
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          { role: "user", text: "я ищу недорогую студию или однушку в паттайе на пратамнаке, что посоветуешь?" },
          { role: "assistant", text: "Сейчас нет публичных карточек кондо рядом с Pratumnak под этот запрос." },
          { role: "user", text: "меня интересует аренда, бюджет до 20 тысяч, планирую въехать в конце ноября, контракт на полгода" },
          { role: "assistant", text: "Сейчас нет публичных карточек кондо рядом с Pratumnak под этот запрос." }
        ],
        locale: "ru",
        market: "pattaya",
        message: "может, на джомтьене что-то есть?"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual(["Studio Condo at Jomtien Beach - Jomtien"]);
    expect(response.recommendedListings).toEqual([
      {
        propertyId: "jomtien-studio",
        title: "Studio Condo at Jomtien Beach - Jomtien",
        url: "https://agency.example.com/listings/jomtien-studio"
      }
    ]);
    expect(response.answer).toContain("район: Jomtien");
    expect(response.answer).toContain("в районе Jomtien");
    expect(response.answer).not.toContain("[Studio Condo at Jomtien Beach - Jomtien]");
    expect(response.answer).not.toContain("[Открыть объект]");
    expect(response.answer).not.toContain("Pratumnak");
  });

  it("recognizes Russian two-bedroom and three-bedroom layout requests in widget cards", async () => {
    const controller = publicWidgetControllerForProperties(
      ["studio", "two-bedroom", "three-bedroom"],
      new Map([
        ["studio", propertyFactory({ bedrooms: 0, id: "studio", title: "Studio Condo at Jomtien" })],
        ["two-bedroom", propertyFactory({ bedrooms: 2, id: "two-bedroom", title: "2BR Condo at Jomtien" })],
        ["three-bedroom", propertyFactory({ bedrooms: 3, id: "three-bedroom", title: "3BR Condo at Jomtien" })]
      ])
    );

    const twoBedroomResponse = await controller.ask(
      "demo-agency",
      {
        locale: "ru",
        market: "pattaya",
        message: "нужна двушка на джомтьене"
      },
      requestFactory(),
      "https://agency.example.com"
    );
    const threeBedroomResponse = await controller.ask(
      "demo-agency",
      {
        locale: "ru",
        market: "pattaya",
        message: "а трешка на джомтьене есть?"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(twoBedroomResponse.recommendedListings.map((listing) => listing.title)).toEqual(["2BR Condo at Jomtien"]);
    expect(twoBedroomResponse.answer).toContain("2 спальни");
    expect(threeBedroomResponse.recommendedListings.map((listing) => listing.title)).toEqual(["3BR Condo at Jomtien"]);
    expect(threeBedroomResponse.answer).toContain("3 спальни");
  });

  it("does not drop Jomtien rental cards when an area target only has an approximate center", async () => {
    const controller = publicWidgetControllerForProperties(
      ["ville-jomtien"],
      new Map([
        [
          "ville-jomtien",
          propertyFactory({
            address: "East Pattaya",
            areaSqm: 34,
            bedrooms: 1,
            id: "ville-jomtien",
            listingType: "sale_or_rent",
            location: { latitude: 12.929, longitude: 100.94 },
            rentalPriceMonthly: { amount: 30_000, currency: "THB" },
            title: "1BR Condo at The Ville Jomtien - East Pattaya"
          })
        ]
      ])
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        market: "pattaya",
        message: "condo for rent 1 year lease at jomtien budget around 30k"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings).toEqual([
      {
        propertyId: "ville-jomtien",
        title: "1BR Condo at The Ville Jomtien - East Pattaya",
        url: "https://agency.example.com/listings/ville-jomtien"
      }
    ]);
    expect(response.answer).toContain("1BR Condo at The Ville Jomtien - East Pattaya: 30k THB/mo");
    expect(response.answer).not.toContain("do not have public condo cards");
  });

  it("does not relabel Pratumnak rentals as Jomtien area matches", async () => {
    const controller = publicWidgetControllerForProperties(
      ["siam-oriental", "the-cliff", "city-garden"],
      new Map([
        [
          "siam-oriental",
          propertyFactory({
            id: "siam-oriental",
            listingType: "rent",
            rentalPriceMonthly: { amount: 24_000, currency: "THB" },
            title: "1BR Condo at Siam Oriental Tropical Garden - Pratumnak"
          })
        ],
        [
          "the-cliff",
          propertyFactory({
            id: "the-cliff",
            listingType: "rent",
            rentalPriceMonthly: { amount: 24_000, currency: "THB" },
            title: "1BR Condo at The Cliff - Pratumnak"
          })
        ],
        [
          "city-garden",
          propertyFactory({
            id: "city-garden",
            listingType: "rent",
            rentalPriceMonthly: { amount: 25_000, currency: "THB" },
            title: "1BR Condo at City Garden Pratumnak - Pratumnak"
          })
        ]
      ])
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "ru",
        market: "pattaya",
        message: "найди мне кондо на джомтьене в аренду, бюджет до 30 тысяч"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings).toEqual([]);
    expect(response.answer).toContain("Сейчас нет публичных карточек кондо рядом с Jomtien");
    expect(response.answer).not.toContain("Siam Oriental");
    expect(response.answer).not.toContain("в районе Jomtien");
  });

  it("shows unseen listing cards when the visitor asks for more options", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["property-1", "property-2", "property-3"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "Pratumnak Investment One-Bed" })],
      ["property-2", propertyFactory({ id: "property-2", title: "Terminal 21 Walkable Studio" })],
      ["property-3", propertyFactory({ id: "property-3", title: "Jomtien Compact One-Bed" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
              { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
            ],
            role: "assistant",
            text: "I found 3 matching listings."
          }
        ],
        locale: "en",
        message: "show me more options"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual(["Jomtien Compact One-Bed"]);
    expect(response.answer).toContain("Showing the next 1 option that still match your previous request.");
    expect(response.answer).toContain("Jomtien Compact One-Bed");
  });

  it("excludes listing links from prior assistant text when showing more options", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const shownId = "10000000-0000-4000-8000-000000000001";
    const nextId = "10000000-0000-4000-8000-000000000002";
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 60 matching listings.",
          matchedPropertyIds: [shownId, nextId],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [shownId, propertyFactory({ id: shownId, title: "Already Shown Family Condo" })],
      [nextId, propertyFactory({ id: nextId, title: "Next Family Condo" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            role: "assistant",
            text: `Already Shown Family Condo http://localhost:3002/listings/${shownId}`
          }
        ],
        locale: "en",
        message: "show me more options"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual(["Next Family Condo"]);
    expect(response.answer).toContain("Showing the next 1 option that still match your previous request.");
    expect(response.answer).not.toContain("Already Shown Family Condo:");
    expect(response.answer).not.toContain("I found 60 matching listings");
  });

  it("shows all public listing cards when the visitor asks for all options", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["property-1", "property-2", "property-3"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "Terminal 21 Walkable Studio" })],
      ["property-2", propertyFactory({ id: "property-2", title: "Central Pattaya Rental Loft" })],
      ["property-3", propertyFactory({ id: "property-3", title: "Wongamat Sea View Residence" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Terminal 21 Walkable Studio" },
              { propertyId: "property-2", title: "Central Pattaya Rental Loft" }
            ],
            role: "assistant",
            text: "I found 3 matching listings."
          }
        ],
        locale: "en",
        message: "show me all options"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Terminal 21 Walkable Studio",
      "Central Pattaya Rental Loft",
      "Wongamat Sea View Residence"
    ]);
    expect(response.answer).toContain("Here are the top 3 I can show now");
    expect(response.answer).toContain("Wongamat Sea View Residence");
  });

  it("fills all-options cards from later public candidates when an early candidate is hidden", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 4 matching listings.",
          matchedPropertyIds: ["property-1", "property-2", "smoke-property", "property-4"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "Terminal 21 Walkable Studio" })],
      ["property-2", propertyFactory({ id: "property-2", title: "Central Pattaya Rental Loft" })],
      ["smoke-property", propertyFactory({ id: "smoke-property", title: "Smoke Beach Condo smoke-eb330e15" })],
      ["property-4", propertyFactory({ id: "property-4", title: "Wongamat Sea View Residence" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Terminal 21 Walkable Studio" },
              { propertyId: "property-2", title: "Central Pattaya Rental Loft" }
            ],
            role: "assistant",
            text: "I found 4 matching listings."
          }
        ],
        locale: "en",
        message: "show me all options"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Terminal 21 Walkable Studio",
      "Central Pattaya Rental Loft",
      "Wongamat Sea View Residence"
    ]);
    expect(response.answer).toContain("I found 3 matching listings. Here are the top 3 I can show now.");
    expect(response.answer).not.toContain("Smoke Beach Condo");
  });

  it("does not expose raw search drafts when more options have no public cards", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer:
            "I found 4 matching listings. Top matches: Smoke Beach Condo smoke-eb330e15. Relevant knowledge: Internal Concierge Handoff Instructions...",
          matchedPropertyIds: ["smoke-property", "property-1", "property-2"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["smoke-property", propertyFactory({ id: "smoke-property", title: "Smoke Beach Condo smoke-eb330e15" })],
      ["property-1", propertyFactory({ id: "property-1", title: "Terminal 21 Walkable Studio" })],
      ["property-2", propertyFactory({ id: "property-2", title: "Central Pattaya Rental Loft" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Terminal 21 Walkable Studio" },
              { propertyId: "property-2", title: "Central Pattaya Rental Loft" }
            ],
            role: "assistant",
            text: "I found 3 matching listings."
          }
        ],
        locale: "en",
        message: "show me more options"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings).toEqual([]);
    expect(response.answer).toContain("I do not have public listing cards");
    expect(response.answer).not.toContain("Top matches");
    expect(response.answer).not.toContain("Relevant knowledge");
    expect(response.answer).not.toContain("Smoke Beach Condo");
  });

  it("counts only public listing cards in compact widget summaries", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["property-1", "property-2", "smoke-property"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "Terminal 21 Walkable Studio" })],
      ["property-2", propertyFactory({ id: "property-2", title: "Central Pattaya Rental Loft" })],
      ["smoke-property", propertyFactory({ id: "smoke-property", title: "Smoke Beach Condo smoke-eb330e15" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo in pattaya under 30k/month"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Terminal 21 Walkable Studio",
      "Central Pattaya Rental Loft"
    ]);
    expect(response.answer).toContain("I found 2 matching listings. Here are the top 2 I can show now.");
    expect(response.answer).not.toContain("I found 3 matching listings");
    expect(response.answer).not.toContain("Smoke Beach Condo");
  });

  it("summarizes rental widget results with monthly rent instead of sale price", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 2 matching listings.",
          matchedPropertyIds: ["property-1", "property-2"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "property-1",
        propertyFactory({
          id: "property-1",
          listingType: "sale_or_rent",
          price: { amount: 3_450_000, currency: "THB" },
          rentalPriceMonthly: { amount: 28_000, currency: "THB" },
          title: "Wongamat Sea View Residence"
        })
      ],
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          listingType: "rent",
          price: { amount: 7_800_000, currency: "THB" },
          rentalPriceMonthly: { amount: 29_000, currency: "THB" },
          title: "Na Jomtien Beachfront Lease"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo in pattaya under 30k per month"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("28k-29k THB/mo");
    expect(response.answer).toContain("Wongamat Sea View Residence: 28k THB/mo");
    expect(response.answer).not.toContain("3.5M-7.8M THB");
  });

  it("summarizes buy and investment widget results with sale price instead of monthly rent", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 1 matching listing.",
          matchedPropertyIds: ["property-1"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockResolvedValue(
          propertyFactory({
            id: "property-1",
            listingType: "sale_or_rent",
            price: { amount: 3_450_000, currency: "THB" },
            rentalPriceMonthly: { amount: 28_000, currency: "THB" },
            title: "Wongamat Sea View Residence"
          })
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "i want to buy a condo in pattaya for investment under 5m, what can you recommend?"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("3.5M THB");
    expect(response.answer).not.toContain("28k THB/mo");
  });

  it("does not expose draft or incomplete listings as public widget recommendation cards", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer:
            "I found 9 matching listings, and I'm happy to share the top 3 with you!\n\n1. **Starter Import Real Listing starter-import-73d24796**",
          matchedPropertyIds: ["draft-property", "zero-price", "tiny-area", "property-available"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["draft-property", propertyFactory({ id: "draft-property", price: { amount: 0, currency: "THB" }, status: "draft", title: "Draft Import" })],
      ["zero-price", propertyFactory({ id: "zero-price", price: { amount: 0, currency: "THB" }, title: "Zero Price Import" })],
      ["tiny-area", propertyFactory({ areaSqm: 1, id: "tiny-area", title: "Tiny Bad Import" })],
      ["property-available", propertyFactory({ id: "property-available", title: "Pratumnak Investment One-Bed" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "find me a condo in pattaya under 3m"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings).toEqual([
      expect.objectContaining({
        propertyId: "property-available",
        title: "Pratumnak Investment One-Bed"
      })
    ]);
    expect(response.answer).toContain("Here is the top match");
    expect(response.answer).not.toContain("Draft Import");
    expect(response.answer).not.toContain("0 THB");
    expect(response.answer).not.toContain("1 sqm");
  });

  it("replaces incomplete listing prose with a finished grounded widget summary", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer:
            "I found 9 matching listings for condos in Pattaya under 3 million THB, and I'm showing you the top matches that fit your request to buy.\n\nThe Pratumnak Investment One-Bed is a strong option for purchase at",
          matchedPropertyIds: ["property-1", "property-2"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "Pratumnak Investment One-Bed" })],
      ["property-2", propertyFactory({ areaSqm: 32, id: "property-2", price: { amount: 2_500_000, currency: "THB" }, title: "Terminal 21 Walkable Studio" })]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "i want to buy a condo in pattaya under 3m"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("I found 2 matching listings. Here are the top 2 I can show now.");
    expect(response.answer).toContain("These condo options fit the Pattaya search");
    expect(response.answer).toContain("Pratumnak Investment One-Bed:");
    expect(response.answer).toContain("Terminal 21 Walkable Studio:");
    expect(response.answer).not.toContain("strong option for purchase at");
    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Pratumnak Investment One-Bed",
      "Terminal 21 Walkable Studio"
    ]);
  });

  it("explains pet-friendly fit in public listing summaries", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 16 matching listings.",
          matchedPropertyIds: ["property-1", "property-2"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "property-1",
        propertyFactory({
          amenities: ["pet-friendly", "garden", "parking"],
          areaSqm: 120,
          bedrooms: 3,
          id: "property-1",
          kind: "villa",
          title: "Jomtien Pet Garden Villa"
        })
      ],
      [
        "property-2",
        propertyFactory({
          amenities: ["pet-friendly", "pool"],
          areaSqm: 65,
          bedrooms: 2,
          id: "property-2",
          title: "Pratumnak Pet Condo"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "i need a room in pattaya for living with 2 dogs"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("pet-friendly signals");
    expect(response.answer).toContain("2+ bedrooms or 60+ sqm");
    expect(response.answer).toContain("dog size limits");
    expect(response.answer).toContain("whether you want to rent or buy");
    expect(response.answer).toContain("your budget");
    expect(response.answer).toContain("preferred area or beach distance");
    expect(response.answer).toContain("timing");
    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Jomtien Pet Garden Villa",
      "Pratumnak Pet Condo"
    ]);
  });

  it("keeps pet and spacious context when a visitor refines the search", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 1 matching listing.",
          matchedPropertyIds: ["property-1", "property-2", "property-3"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "property-1",
        propertyFactory({
          amenities: ["pet-friendly", "balcony", "24h security", "communal pool"],
          areaSqm: 25.6,
          bedrooms: 1,
          id: "property-1",
          listingType: "rent",
          rentalPriceMonthly: { amount: 20_000, currency: "THB" },
          title: "1BR Condo at Lumpini Ville Naklua - Naklua"
        })
      ],
      [
        "property-2",
        propertyFactory({
          amenities: ["pet-friendly", "garden", "kids playground", "24h security"],
          areaSqm: 34,
          bedrooms: 1,
          id: "property-2",
          listingType: "rent",
          rentalPriceMonthly: { amount: 19_000, currency: "THB" },
          title: "1BR Condo at The Ville Jomtien - East Pattaya"
        })
      ],
      [
        "property-3",
        propertyFactory({
          amenities: ["pet-friendly", "gym", "coworking space", "European kitchen"],
          areaSqm: 31.6,
          bedrooms: 1,
          id: "property-3",
          listingType: "rent",
          rentalPriceMonthly: { amount: 25_000, currency: "THB" },
          title: "1BR Condo at City Garden Pratumnak - Pratumnak"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            role: "user",
            text: "I'm looking for a room in Pattaya for living with 2 dogs, what can you recommend?"
          },
          {
            role: "assistant",
            text: "To narrow this down, tell me whether you want to rent or buy, your budget, preferred area or beach distance, and timing."
          }
        ],
        locale: "en",
        message:
          "i mean i would like to rent 1 bedroom or a studio, but quite spacious, beach distance is not important, budget is under 30k, i would like to move in next month"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toContain("I found 3 matching listings. Here are the top 3 I can show now.");
    expect(response.answer).toContain("19k-25k THB/mo");
    expect(response.answer).toContain("25.6-34 sqm");
    expect(response.answer).toContain("3/3 shown options have pet-friendly signals");
    expect(response.answer).toContain("0/3 offer 2+ bedrooms or 60+ sqm");
    expect(response.answer).toContain("compact for two dogs");
    expect(response.answer).toContain("larger pet-friendly studios or 1-bedrooms");
    expect(response.answer).not.toContain("I found 1 matching listing. Here are the top 3");
    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "1BR Condo at The Ville Jomtien - East Pattaya",
      "1BR Condo at City Garden Pratumnak - Pratumnak",
      "1BR Condo at Lumpini Ville Naklua - Naklua"
    ]);
  });

  it("reranks public cards by explicit spacious and sea-view criteria", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["the-cliff", "siam-oriental", "wongamat"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "the-cliff",
        propertyFactory({
          amenities: ["key card access", "European kitchen", "washing machine"],
          areaSqm: 29.8,
          beachDistanceMeters: 707,
          id: "the-cliff",
          listingType: "rent",
          rentalPriceMonthly: { amount: 24_000, currency: "THB" },
          title: "1BR Condo at The Cliff - Pratumnak"
        })
      ],
      [
        "siam-oriental",
        propertyFactory({
          amenities: ["balcony", "European kitchen", "24h security"],
          areaSqm: 27.3,
          beachDistanceMeters: 134,
          id: "siam-oriental",
          listingType: "rent",
          rentalPriceMonthly: { amount: 24_000, currency: "THB" },
          title: "1BR Condo at Siam Oriental Tropical Garden - Pratumnak"
        })
      ],
      [
        "wongamat",
        propertyFactory({
          amenities: ["sea-view", "pool", "gym"],
          areaSqm: 42,
          beachDistanceMeters: 220,
          id: "wongamat",
          listingType: "rent",
          rentalPriceMonthly: { amount: 28_000, currency: "THB" },
          title: "Wongamat Sea View Residence"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "I'm looking for a spacious studio close to the beach and with sea view for rent under 30k/month"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Wongamat Sea View Residence",
      "1BR Condo at The Cliff - Pratumnak",
      "1BR Condo at Siam Oriental Tropical Garden - Pratumnak"
    ]);
    expect(response.answer.indexOf("Wongamat Sea View Residence:")).toBeLessThan(
      response.answer.indexOf("1BR Condo at The Cliff - Pratumnak:")
    );
    expect(response.answer).toContain("amenities like sea-view");
  });

  it("reranks public cards toward budget-friendly options", async () => {
    const controller = publicWidgetControllerForProperties(
      ["expensive", "cheap"],
      new Map([
        ["expensive", propertyFactory({ id: "expensive", price: { amount: 4_800_000, currency: "THB" }, title: "Pricier Pattaya Condo" })],
        ["cheap", propertyFactory({ id: "cheap", price: { amount: 2_200_000, currency: "THB" }, title: "Affordable Pattaya Condo" })]
      ])
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "show me budget-friendly affordable condos in Pattaya under 5m"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Affordable Pattaya Condo",
      "Pricier Pattaya Condo"
    ]);
  });

  it("reranks public cards toward premium options", async () => {
    const controller = publicWidgetControllerForProperties(
      ["basic", "premium"],
      new Map([
        [
          "basic",
          propertyFactory({
            amenities: ["pool"],
            areaSqm: 60,
            id: "basic",
            price: { amount: 6_000_000, currency: "THB" },
            title: "Large Basic Condo"
          })
        ],
        [
          "premium",
          propertyFactory({
            amenities: ["sea-view", "gym", "sauna", "covered parking"],
            areaSqm: 52,
            id: "premium",
            price: { amount: 5_700_000, currency: "THB" },
            title: "Premium Sea View Condo"
          })
        ]
      ])
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message: "show me a premium luxury condo in Pattaya"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "Premium Sea View Condo",
      "Large Basic Condo"
    ]);
  });

  it("prioritizes mandatory washing machine and family fit in public cards", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 4 matching listings.",
          matchedPropertyIds: ["wongamat", "edge", "ad-hyatt", "family-washer"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "wongamat",
        propertyFactory({
          amenities: ["sea-view", "pool", "gym"],
          areaSqm: 42,
          bedrooms: 1,
          id: "wongamat",
          price: { amount: 3_500_000, currency: "THB" },
          title: "Wongamat Sea View Residence"
        })
      ],
      [
        "edge",
        propertyFactory({
          amenities: ["gym", "kids playground", "key card access"],
          areaSqm: 35.4,
          bedrooms: 1,
          id: "edge",
          price: { amount: 4_200_000, currency: "THB" },
          title: "1BR Condo at Edge Central Pattaya - Central Pattaya"
        })
      ],
      [
        "ad-hyatt",
        propertyFactory({
          amenities: ["shuttle service", "kids playground", "washing machine"],
          areaSqm: 34.6,
          bedrooms: 0,
          id: "ad-hyatt",
          price: { amount: 3_100_000, currency: "THB" },
          title: "Studio Condo at AD Hyatt Condominium - Naklua"
        })
      ],
      [
        "family-washer",
        propertyFactory({
          amenities: ["washing machine", "kids playground", "garden"],
          areaSqm: 58,
          bedrooms: 2,
          id: "family-washer",
          price: { amount: 4_900_000, currency: "THB" },
          title: "2BR Family Condo near School"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message:
          "I need an apartment in Pattaya for living with children—ideally near a school and definitely with a washing machine. What can you offer? Budget under 5m"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "2BR Family Condo near School"
    ]);
    expect(response.answer).toContain("I found 1 matching listing. Here is the top match I can show now.");
    expect(response.answer).toContain("amenities like washing machine");
    expect(response.answer).toContain("For living with children");
    expect(response.answer).toContain("School proximity is not confirmed");
    expect(response.answer).not.toContain("tell me whether you want to rent or buy");
    expect(response.answer).not.toContain("your budget");
  });

  it("keeps washer as a soft preference when it is not mandatory", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer: "I found 3 matching listings.",
          matchedPropertyIds: ["no-washer-family", "washer-family", "studio-washer"],
          suggestedActions: ["compare-results", "open-map", "save-search"]
        })
      )
    } as unknown as AiChatService;
    const propertiesById = new Map([
      [
        "no-washer-family",
        propertyFactory({
          amenities: ["kids playground", "garden"],
          areaSqm: 62,
          bedrooms: 2,
          id: "no-washer-family",
          price: { amount: 4_500_000, currency: "THB" },
          title: "2BR Family Condo without Washer"
        })
      ],
      [
        "washer-family",
        propertyFactory({
          amenities: ["washing machine", "kids playground"],
          areaSqm: 54,
          bedrooms: 2,
          id: "washer-family",
          price: { amount: 4_800_000, currency: "THB" },
          title: "2BR Family Condo with Washer"
        })
      ],
      [
        "studio-washer",
        propertyFactory({
          amenities: ["washing machine"],
          areaSqm: 38,
          bedrooms: 0,
          id: "studio-washer",
          price: { amount: 3_200_000, currency: "THB" },
          title: "Studio Condo with Washer"
        })
      ]
    ]);
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertiesById.get(propertyId) ?? null)
        )
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "en",
        message:
          "I need an apartment in Pattaya for living with children—ideally near a school and with a washing machine. What can you offer? Budget under 5m"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).not.toContain("I do not have additional public listing cards");
    expect(response.recommendedListings.map((listing) => listing.title)).toEqual([
      "2BR Family Condo with Washer",
      "2BR Family Condo without Washer"
    ]);
    expect(response.answer).toContain("amenities like washing machine");
  });

  it("preserves property follow-up answers instead of rewriting them as a new search", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(
        chatResponse({
          answer:
            "Pratumnak Investment One-Bed fits your budget and buying intent. I can ask the agency to confirm viewing availability and the current foreign-quota status.",
          matchedPropertyIds: ["property-1"],
          suggestedActions: ["compare-similar-properties", "open-investment-calculator", "create-lead"]
        })
      )
    } as unknown as AiChatService;
    const controller = new PublicWidgetChatController(
      tenants,
      chat,
      { create: vi.fn() } as unknown as LeadService,
      propertyRepository({
        findById: vi.fn().mockResolvedValue(propertyFactory({ id: "property-1", title: "Pratumnak Investment One-Bed" }))
      }),
      rateLimitService()
    );

    const response = await controller.ask(
      "demo-agency",
      {
        conversation: [
          {
            recommendedListings: [{ propertyId: "property-1", title: "Pratumnak Investment One-Bed" }],
            role: "assistant",
            text: "I found 3 matching listings."
          }
        ],
        locale: "en",
        message: "i like the first option, may i see it?"
      },
      requestFactory(),
      "https://agency.example.com"
    );

    expect(response.answer).toBe(
      "Pratumnak Investment One-Bed fits your budget and buying intent. I can ask the agency to confirm viewing availability and the current foreign-quota status."
    );
    expect(response.answer).not.toContain("[Pratumnak Investment One-Bed]");
    expect(response.answer).not.toContain("[Open listing]");
    expect(response.answer).not.toContain("I found 1 matching listing");
    expect(response.recommendedListings).toEqual([
      {
        propertyId: "property-1",
        title: "Pratumnak Investment One-Bed",
        url: "https://agency.example.com/listings/property-1"
      }
    ]);
  });

  it("keeps recommended listing links on the widget origin when tenant route config is unsafe", async () => {
    const tenant = tenantFactory({
      id: "tenant-rag",
      widget: {
        ...tenantFactory().widget,
        allowedOrigins: ["https://agency.example.com"],
        listingUrlTemplate: "https://evil.example.com/listings/:propertyId"
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const chat = {
      ask: vi.fn().mockResolvedValue(chatResponse({ matchedPropertyIds: ["property-1"] }))
    } as unknown as AiChatService;
    const leads = {
      create: vi.fn()
    } as unknown as LeadService;
    const properties = propertyRepository({
      findById: vi.fn().mockResolvedValue(propertyFactory({ id: "property-1", title: "Wongamat Sea View Residence" }))
    });
    const controller = new PublicWidgetChatController(tenants, chat, leads, properties, rateLimitService());

    await expect(
      controller.ask(
        "demo-agency",
        {
          locale: "en",
          message: "Show me sea view condos"
        },
        requestFactory(),
        "https://agency.example.com"
      )
    ).resolves.toMatchObject({
      recommendedListings: [
        {
          propertyId: "property-1",
          title: "Wongamat Sea View Residence",
          url: "https://agency.example.com/listings/property-1"
        }
      ]
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
    const controller = new PublicWidgetChatController(tenants, chat, leads, propertyRepository(), rateLimitService());

    const response = await controller.ask(
      "demo-agency",
      {
        locale: "zh",
        message: "海景公寓"
      },
      requestFactory()
    );

    expect(response.locale).toBe("ru");
    expect(chat.ask).toHaveBeenCalledWith(
      "tenant-1",
      {
        locale: "ru",
        message: "海景公寓"
      },
      {
        persona: {
          gender: "feminine",
          leadQualificationFields: ["budget", "preferredArea", "email", "phone"],
          name: "Анна",
          tone: "friendly",
          welcomeMessage: "Привет! Я Анна, ваш AI-консультант по недвижимости."
        }
      }
    );
  });

  it("rejects oversized widget ask messages before calling the LLM", async () => {
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
    const controller = new PublicWidgetChatController(tenants, chat, leads, propertyRepository(), rateLimitService());

    await expect(
      controller.ask(
        "demo-agency",
        {
          locale: "en",
          message: "x".repeat(2_001)
        },
        requestFactory()
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(chat.ask).not.toHaveBeenCalled();
  });

  it("creates a tenant-scoped lead from public widget handoff", async () => {
    const tenant = tenantFactory({
      id: "tenant-handoff",
      slug: "demo-agency",
      subscriptionPlan: "growth",
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
    const controller = new PublicWidgetChatController(tenants, chat, leads, propertyRepository(), rateLimitService());

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
      conciergeMode: "growth",
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
      message: "Widget handoff request.\n\nVisitor note: I want a viewing next week.\n\nLead qualification:\nViewing time: next week",
      preferredLocale: "ru",
      propertyId: undefined,
      source: "ai-concierge"
    });
  });

  it("creates a Starter qualified lead without CRM handoff copy", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "starter"
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
      create: vi.fn().mockResolvedValue(leadFactory({ tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads, propertyRepository(), rateLimitService());

    await expect(
      controller.createLead(
        "demo-agency",
        {
          contactEmail: "buyer@example.com",
          contactName: "Buyer",
          locale: "en",
          message: "Please contact me."
        },
        "https://agency.example.com"
      )
    ).resolves.toMatchObject({
      conciergeMode: "starter",
      message: "Thanks. The agency has your qualified request and can follow up.",
      status: "new",
      tenantSlug: "demo-agency"
    });

    expect(tenants.assertPublicWidgetOriginAllowed).toHaveBeenCalledWith(tenant, "https://agency.example.com", undefined);
    expect(leads.create).toHaveBeenCalledWith(tenant.id, {
      contactEmail: "buyer@example.com",
      contactName: "Buyer",
      contactPhone: undefined,
      message: "Widget handoff request.\n\nVisitor note: Please contact me.",
      preferredLocale: "en",
      propertyId: undefined,
      source: "ai-concierge"
    });
  });

  it("creates a Starter qualified lead with conversation context and recommended listing", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "starter"
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
      create: vi.fn().mockResolvedValue(leadFactory({ propertyId: "property-1", tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads, propertyRepository(), rateLimitService());

    await controller.createLead(
      "demo-agency",
      {
        contactEmail: "buyer@example.com",
        contactName: "Buyer",
        conversation: [
          { role: "user", text: "I need a condo in Pattaya under 3M" },
          {
            recommendedListings: [{ propertyId: "property-1", title: "Wongamat Sea View Residence" }],
            role: "assistant",
            text: "I found a matching option."
          },
          { role: "user", text: "I want to view it next month." }
        ],
        locale: "en",
        message: "Please use WhatsApp.",
        recommendedListings: [{ propertyId: "property-1", title: "Wongamat Sea View Residence" }]
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, {
      contactEmail: "buyer@example.com",
      contactName: "Buyer",
      contactPhone: undefined,
      message: [
        "Widget handoff request.",
        "",
        "Visitor note: Please use WhatsApp.",
        "",
        "Lead qualification:",
        "Budget: under 3M",
        "Viewing time: next month",
        "Contact channel: WhatsApp",
        "",
        "Recommended listings:",
        "1. Wongamat Sea View Residence (property-1)",
        "",
        "Recent widget conversation:",
        "user: I need a condo in Pattaya under 3M",
        "assistant: I found a matching option.",
        "Shown listings:",
        "1. Wongamat Sea View Residence (property-1)",
        "user: I want to view it next month."
      ].join("\n"),
      preferredLocale: "en",
      propertyId: "property-1",
      source: "ai-concierge"
    });
  });

  it("adds purchase intent, ownership quota, and purchase timing to widget leads", async () => {
    const tenant = tenantFactory({ subscriptionPlan: "starter" });
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      {
        assertPublicWidgetOriginAllowed: vi.fn(),
        getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
        recordPublicWidgetAsk: vi.fn()
      } as unknown as TenantService,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactEmail: "buyer@example.com",
        contactName: "Buyer",
        conversation: [
          { role: "user", text: "I want to buy a condo in Pattaya under 5M" },
          { role: "user", text: "foreign quota, probably next year" }
        ],
        locale: "en",
        message: "Please contact me on email",
        recommendedListings: [{ propertyId: "property-1", title: "Pratumnak Investment One-Bed" }]
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Intent: Buy")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Ownership/quota: Foreign quota")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Purchase timing: next year")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.not.stringContaining("Timing: next year")
    }));
  });

  it("adds rental intent, move-in date, and contract length to widget leads", async () => {
    const tenant = tenantFactory({ subscriptionPlan: "starter" });
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      {
        assertPublicWidgetOriginAllowed: vi.fn(),
        getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
        recordPublicWidgetAsk: vi.fn()
      } as unknown as TenantService,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactPhone: "+660827955673",
        contactName: "Website visitor",
        conversation: [
          { role: "user", text: "find me a condo in pattaya under 30k per month" },
          { role: "user", text: "I want to move in next month for 6 months" }
        ],
        locale: "en",
        message: "my phone number +660827955673",
        recommendedListings: [{ propertyId: "property-2", title: "Terminal 21 Walkable Studio" }]
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Intent: Rent")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Move-in: next month")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Contract length: 6 months")
    }));
  });

  it("captures Russian rental qualification and the latest selected listing in widget leads", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "starter",
      widget: {
        ...tenantFactory().widget,
        languages: ["ru", "en"]
      }
    });
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ propertyId: "jomtien-1br", tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      {
        assertPublicWidgetOriginAllowed: vi.fn(),
        getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
        recordPublicWidgetAsk: vi.fn()
      } as unknown as TenantService,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    const response = await controller.createLead(
      "demo-agency",
      {
        contactName: "Website visitor",
        contactPhone: "Telegram @GermanSklyarov",
        conversation: [
          { role: "user", text: "я ищу недорогую студию или однушку в паттайе на пратамнаке, что посоветуешь?" },
          {
            recommendedListings: [{ propertyId: "pratumnak-1br", title: "1BR Condo at Siam Oriental Tropical Garden - Pratumnak" }],
            role: "assistant",
            text: "Я нашла варианты на Пратамнаке."
          },
          { role: "user", text: "меня интересует аренда, бюджет до 20 тысяч, планирую въехать в конце ноября, контракт на полгода" },
          { role: "assistant", text: "Сейчас нет публичных карточек кондо рядом с Pratumnak под этот запрос." },
          { role: "user", text: "может, на джомтьене есть?" },
          {
            recommendedListings: [{ propertyId: "jomtien-1br", title: "1BR Condo at The Ville Jomtien - East Pattaya" }],
            role: "assistant",
            text: "Я нашла 1 подходящий вариант."
          },
          { role: "user", text: "пойдет, как записаться на просмотр?" }
        ],
        locale: "ru",
        message: "я бы хотел посмотреть в понедельник в час дня, мой ТГ @GermanSklyarov",
        recommendedListings: [{ propertyId: "jomtien-1br", title: "1BR Condo at The Ville Jomtien - East Pattaya" }]
      },
      "https://agency.example.com"
    );

    expect(response.message).toBe("Спасибо. Агентство получило ваш запрос и сможет связаться с вами.");
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      contactPhone: "Telegram @GermanSklyarov",
      preferredLocale: "ru",
      propertyId: "jomtien-1br"
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Intent: Rent")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Budget: до 20 тысяч")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Move-in: в конце ноября")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Contract length: полгода")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Viewing time: понедельник в час дня")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Contact channel: Telegram")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("1. 1BR Condo at The Ville Jomtien - East Pattaya (jomtien-1br)")
    }));
  });

  it("keeps the selected listing and viewing slot in auto-captured widget leads", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "starter"
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ propertyId: "property-2", tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      tenants,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactName: "Website visitor",
        contactPhone: "+660827955673",
        conversation: [
          { role: "user", text: "find me a condo in pattaya under 3m" },
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
              { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
            ],
            role: "assistant",
            text: "I found 3 matching listings."
          },
          { role: "user", text: "i like the second option, can i view it on friday at 3 pm?" }
        ],
        locale: "en",
        message: "my phone number +660827955673",
        recommendedListings: [{ propertyId: "property-2", title: "Terminal 21 Walkable Studio" }]
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Viewing time: friday at 3 pm"),
      propertyId: "property-2"
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("1. Terminal 21 Walkable Studio (property-2)")
    }));
  });

  it("extracts concrete viewing dates from widget leads", async () => {
    const tenant = tenantFactory({ subscriptionPlan: "starter" });
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ propertyId: "property-2", tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      {
        assertPublicWidgetOriginAllowed: vi.fn(),
        getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
        recordPublicWidgetAsk: vi.fn()
      } as unknown as TenantService,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactName: "Website visitor",
        contactPhone: "+660827955673",
        conversation: [
          { role: "user", text: "find me a condo in pattaya under 3m" },
          {
            recommendedListings: [{ propertyId: "property-2", title: "Terminal 21 Walkable Studio" }],
            role: "assistant",
            text: "I can help arrange this viewing."
          },
          { role: "user", text: "i like the second option, can i view it on 15 august at 3p.m?" }
        ],
        locale: "en",
        message: "my phone number +660827955673",
        recommendedListings: [{ propertyId: "property-2", title: "Terminal 21 Walkable Studio" }]
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Viewing time: 15 august at 3p.m")
    }));
  });

  it("separates viewing time from preferred contact time in widget leads", async () => {
    const tenant = tenantFactory({ subscriptionPlan: "starter" });
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ propertyId: "property-2", tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      {
        assertPublicWidgetOriginAllowed: vi.fn(),
        getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
        recordPublicWidgetAsk: vi.fn()
      } as unknown as TenantService,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactName: "Website visitor",
        contactPhone: "+660827955673",
        conversation: [
          { role: "user", text: "I want to view it next saturday at 2 pm." },
          { role: "user", text: "Please contact me tomorrow morning on LINE." }
        ],
        locale: "en",
        message: "line id german_sklyarov",
        recommendedListings: [{ propertyId: "property-2", title: "Terminal 21 Walkable Studio" }]
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Viewing time: saturday at 2 pm")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Preferred contact time: tomorrow morning")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.not.stringContaining("\nTiming:")
    }));
  });

  it("extracts Thai budget and timing into widget lead qualification", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "starter",
      widget: {
        ...tenantFactory().widget,
        languages: ["th"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      tenants,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactName: "Buyer",
        contactPhone: "+66123456789",
        conversation: [
          { role: "user", text: "คอนโดให้เช่าภูเก็ต งบไม่เกิน 40000 บาทต่อเดือน ทำงานออนไลน์" },
          { role: "user", text: "อยากดูห้องเดือนหน้า ติดต่อทางไลน์" }
        ],
        locale: "th",
        message: "ขอรายละเอียดเพิ่ม"
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Budget: ไม่เกิน 40000 บาทต่อเดือน")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Viewing time: เดือนหน้า")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Contact channel: LINE")
    }));
  });

  it("extracts Chinese investment budget into widget lead qualification", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "starter",
      widget: {
        ...tenantFactory().widget,
        languages: ["zh"]
      }
    });
    const tenants = {
      assertPublicWidgetOriginAllowed: vi.fn(),
      getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
      recordPublicWidgetAsk: vi.fn()
    } as unknown as TenantService;
    const leads = {
      create: vi.fn().mockResolvedValue(leadFactory({ tenantId: tenant.id }))
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(
      tenants,
      { ask: vi.fn() } as unknown as AiChatService,
      leads,
      propertyRepository(),
      rateLimitService()
    );

    await controller.createLead(
      "demo-agency",
      {
        contactEmail: "buyer@example.com",
        contactName: "Buyer",
        conversation: [
          { role: "user", text: "想在芭提雅购买海景公寓，预算不超过300万泰铢，适合投资收益" },
          { role: "user", text: "明天可以联系我" }
        ],
        locale: "zh",
        message: "请发更多资料"
      },
      "https://agency.example.com"
    );

    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Budget: 不超过300万泰铢")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Purpose: Investment")
    }));
    expect(leads.create).toHaveBeenCalledWith(tenant.id, expect.objectContaining({
      message: expect.stringContaining("Preferred contact time: 明天")
    }));
  });

  it("rejects widget handoff without email or phone", async () => {
    const tenant = tenantFactory({
      subscriptionPlan: "growth"
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
      create: vi.fn()
    } as unknown as LeadService;
    const controller = new PublicWidgetChatController(tenants, chat, leads, propertyRepository(), rateLimitService());

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
    insights: [],
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

function propertyFactory(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    amenities: ["pool", "gym", "sea-view"],
    areaSqm: 38,
    bathrooms: 1,
    beachDistanceMeters: 650,
    bedrooms: 1,
    createdAt: "2026-07-20T00:00:00.000Z",
    id: "property-1",
    kind: "condo",
    listingType: "sale",
    location: {
      latitude: 12.9236,
      longitude: 100.8825
    },
    market: "pattaya",
    price: {
      amount: 2_900_000,
      currency: "THB"
    },
    status: "available",
    tenantId: "tenant-1",
    title: "Wongamat Sea View Residence",
    updatedAt: "2026-07-20T00:00:00.000Z",
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
      leadQualificationFields: ["budget", "preferredArea", "email", "phone"],
      listingUrlTemplate: "/listings/:propertyId",
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

function propertyRepository(overrides: Partial<PropertyRepository> = {}): PropertyRepository {
  return {
    addPriceHistoryPoint: vi.fn(),
    createProject: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findProjectById: vi.fn(),
    list: vi.fn(),
    listPriceHistory: vi.fn(),
    save: vi.fn(),
    search: vi.fn(),
    searchAmenities: vi.fn(),
    searchPage: vi.fn(),
    searchProjects: vi.fn(),
    updateAmenities: vi.fn(),
    updateListingText: vi.fn(),
    updatePrice: vi.fn(),
    updateProject: vi.fn(),
    updateProjectRecord: vi.fn(),
    updateStatus: vi.fn(),
    ...overrides
  } as unknown as PropertyRepository;
}

function publicWidgetControllerForProperties(
  matchedPropertyIds: string[],
  propertiesById: Map<string, PropertySnapshot>
): PublicWidgetChatController {
  const tenant = tenantFactory({
    id: "tenant-rag",
    widget: {
      ...tenantFactory().widget,
      allowedOrigins: ["https://agency.example.com"]
    }
  });
  const tenants = {
    assertPublicWidgetOriginAllowed: vi.fn(),
    getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant),
    recordPublicWidgetAsk: vi.fn()
  } as unknown as TenantService;
  const chat = {
    ask: vi.fn().mockResolvedValue(
      chatResponse({
        answer: `I found ${matchedPropertyIds.length} matching listings.`,
        matchedPropertyIds,
        suggestedActions: ["compare-results", "open-map", "save-search"]
      })
    )
  } as unknown as AiChatService;

  return new PublicWidgetChatController(
    tenants,
    chat,
    { create: vi.fn() } as unknown as LeadService,
    propertyRepository({
      findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
        Promise.resolve(propertiesById.get(propertyId) ?? null)
      )
    }),
    rateLimitService()
  );
}

function rateLimitService(): PublicWidgetRateLimitService {
  return {
    checkPublicWidgetAsk: vi.fn().mockResolvedValue(undefined)
  } as unknown as PublicWidgetRateLimitService;
}

function requestFactory(overrides: { headers?: Record<string, string | string[] | undefined>; ip?: string } = {}) {
  return {
    headers: overrides.headers ?? {},
    ip: overrides.ip ?? "198.51.100.20",
    socket: {
      remoteAddress: "198.51.100.21"
    }
  };
}
