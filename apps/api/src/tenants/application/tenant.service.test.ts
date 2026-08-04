import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTenantPlanDefinition, tenantPlanCatalog } from "@propertyflow/contracts";
import type { TenantSnapshot, TenantUserSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";
import { AuthIdentityService } from "../../shared/auth/auth-identity.service.js";
import type { UserService } from "../../users/application/user.service.js";
import type { AgencyEmailTokenRecord } from "../domain/agency-email-token.repository.js";
import type { TenantRepository } from "../domain/tenant.repository.js";
import { AgencyEmailTokenService } from "./agency-email-token.service.js";
import { TenantService } from "./tenant.service.js";

describe("TenantService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
      capabilities: {
        knowledgeAnswers: true,
        leadCapture: false,
        propertySearch: true
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
            subscriptionPlan: "growth",
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

    await expect(service.getPublicWidgetConfig("demo-agency", { origin: "https://agency.example.com" })).resolves.toMatchObject({
      capabilities: {
        knowledgeAnswers: true,
        leadCapture: true,
        propertySearch: true
      },
      readiness: {
        nextAction: "Widget configuration is ready for production installation.",
        status: "ready"
      }
    });
  });

  it("uses the shared plan catalog for public widget capabilities", async () => {
    expect(getTenantPlanDefinition("starter").features.crmLeadCapture).toBe(false);
    expect(tenantPlanCatalog.growth.features.crmLeadCapture).toBe(true);
    expect(tenantPlanCatalog.enterprise.features.automations).toBe(true);

    const service = new TenantService(
      repository({
        findBySlug: async (slug) => tenant({ slug, subscriptionPlan: slug === "starter-agency" ? "starter" : "enterprise" })
      })
    );

    await expect(service.getPublicWidgetConfig("starter-agency")).resolves.toMatchObject({
      capabilities: {
        leadCapture: false
      },
      conciergeMode: "starter"
    });
    await expect(service.getPublicWidgetConfig("enterprise-agency")).resolves.toMatchObject({
      capabilities: {
        leadCapture: true
      },
      conciergeMode: "enterprise"
    });
  });

  it("enforces widget origin allowlist before returning public config", async () => {
    const service = new TenantService(
      repository({
        findBySlug: async () =>
          tenant({
            widget: {
              ...tenant().widget,
              allowedOrigins: ["https://agency.example.com"]
            }
          })
      })
    );

    await expect(service.getPublicWidgetConfig("demo-agency", { referer: "https://agency.example.com/listings" })).resolves.toMatchObject({
      tenantSlug: "demo-agency"
    });
    await expect(service.getPublicWidgetConfig("demo-agency", { origin: "https://evil.example.com" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("provisions a new agency workspace from signup intent", async () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    let capturedInput: Parameters<TenantRepository["provision"]>[0] | undefined;
    const service = new TenantService(
      repository({
        findBySlug: async () => null,
        provision: async (input) => {
          capturedInput = input;

          return tenant({
            branding: {
              displayName: input.name
            },
            customDomain: undefined,
            domainStatus: "not-configured",
            id: input.slug,
            name: input.name,
            slug: input.slug,
            subscriptionPlan: input.subscriptionPlan,
            widget: {
              ...tenant().widget,
              allowedOrigins: input.website ? [input.website] : []
            }
          });
        }
      })
    );

    await expect(
      service.provision({
        agencyName: " Riviera Pattaya Realty ",
        subscriptionPlan: "starter",
        website: "HTTPS://Riviera.Example/listings",
        workEmail: "owner@riviera.example"
      })
    ).resolves.toMatchObject({
      accessToken: expect.any(String),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.any(String),
      refreshTokenExpiresAt: expect.any(String),
      setupUrl: "/setup?plan=starter",
      tenant: {
        branding: {
          displayName: "Riviera Pattaya Realty"
        },
        slug: "riviera-pattaya-realty",
        subscriptionPlan: "starter",
        widget: {
          allowedOrigins: ["https://riviera.example"]
        }
      }
    });
    expect(capturedInput).toEqual({
      name: "Riviera Pattaya Realty",
      ownerEmail: "owner@riviera.example",
      ownerName: "Workspace owner",
      ownerUserId: "manager-demo-1",
      slug: "riviera-pattaya-realty",
      subscriptionPlan: "starter",
      website: "https://riviera.example"
    });
  });

  it("creates an agency session for an active workspace member", async () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    const member = tenantUser({ email: "owner@demo.example", id: "owner-user-1", tenantId: "tenant-demo" });
    const service = new TenantService(
      repository({
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency", subscriptionPlan: "starter" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMemberByEmail: async (tenantId, email) => {
          expect(tenantId).toBe("tenant-demo");
          expect(email).toBe("owner@demo.example");

          return member;
        }
      })
    );

    await expect(
      service.createAgencySession({
        tenantSlug: "demo-agency",
        workEmail: " OWNER@Demo.Example "
      })
    ).resolves.toMatchObject({
      accessToken: expect.any(String),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.any(String),
      refreshTokenExpiresAt: expect.any(String),
      setupUrl: "/setup?plan=starter",
      tenant: {
        id: "tenant-demo"
      },
      user: {
        id: "owner-user-1"
      }
    });
  });

  it("accepts a magic-link request for an active workspace member without exposing production tokens", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const issuedAt = new Date("2026-07-31T10:00:00.000Z");
    const expiresAt = new Date("2026-07-31T10:15:00.000Z");
    const member = tenantUser({ email: "owner@demo.example", id: "owner-user-1", tenantId: "tenant-demo" });
    const issue = vi.fn(async () => ({
      record: agencyEmailToken({
        createdAt: issuedAt,
        email: "owner@demo.example",
        expiresAt,
        tenantId: "tenant-demo"
      }),
      token: "magic-token-value"
    }));
    const service = new TenantService(
      repository({
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMemberByEmail: async (tenantId, email) => {
          expect(tenantId).toBe("tenant-demo");
          expect(email).toBe("owner@demo.example");

          return member;
        }
      }),
      undefined,
      agencyEmailTokens({ issue })
    );

    const response = await service.requestAgencyMagicLink({
      tenantSlug: "demo-agency",
      workEmail: " OWNER@Demo.Example "
    });

    expect(response).toEqual({
      accepted: true,
      delivery: "email",
      expiresAt: "2026-07-31T10:15:00.000Z",
      message: "If this workspace user exists, a secure sign-in link will be sent to the work email."
    });
    expect(response.developmentMagicLinkUrl).toBeUndefined();
    expect(response.developmentToken).toBeUndefined();
    expect(issue).toHaveBeenCalledWith({
      email: "owner@demo.example",
      metadata: {
        tenantSlug: "demo-agency",
        userId: "owner-user-1"
      },
      purpose: "magic-link",
      tenantId: "tenant-demo"
    });
  });

  it("returns a local development magic-link URL outside production", async () => {
    vi.stubEnv("AGENCY_APP_BASE_URL", "https://agency.propertyflow.test/app/");
    const expiresAt = new Date("2026-07-31T10:15:00.000Z");
    const member = tenantUser({ email: "owner@demo.example", id: "owner-user-1", tenantId: "tenant-demo" });
    const service = new TenantService(
      repository({
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMemberByEmail: async () => member
      }),
      undefined,
      agencyEmailTokens({
        issue: async () => ({
          record: agencyEmailToken({
            email: "owner@demo.example",
            expiresAt,
            tenantId: "tenant-demo"
          }),
          token: "magic token/value"
        })
      })
    );

    await expect(
      service.requestAgencyMagicLink({
        tenantSlug: "demo-agency",
        workEmail: "owner@demo.example"
      })
    ).resolves.toMatchObject({
      developmentMagicLinkUrl:
        "https://agency.propertyflow.test/signin/magic?token=magic+token%2Fvalue&workspace=demo-agency",
      developmentToken: "magic token/value",
      expiresAt: "2026-07-31T10:15:00.000Z"
    });
  });

  it("keeps magic-link requests neutral for unknown workspace emails", async () => {
    const issue = vi.fn();
    const service = new TenantService(
      repository({
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMemberByEmail: async () => null
      }),
      undefined,
      agencyEmailTokens({ issue })
    );

    await expect(
      service.requestAgencyMagicLink({
        tenantSlug: "demo-agency",
        workEmail: "missing@demo.example"
      })
    ).resolves.toEqual({
      accepted: true,
      delivery: "email",
      message: "If this workspace user exists, a secure sign-in link will be sent to the work email."
    });
    expect(issue).not.toHaveBeenCalled();
  });

  it("exchanges a valid magic-link token for an agency session", async () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    const member = tenantUser({ email: "owner@demo.example", id: "owner-user-1", tenantId: "tenant-demo" });
    const consume = vi.fn(async () =>
      agencyEmailToken({
        email: "owner@demo.example",
        purpose: "magic-link",
        tenantId: "tenant-demo"
      })
    );
    const service = new TenantService(
      repository({
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency", subscriptionPlan: "starter" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMemberByEmail: async (tenantId, email) => {
          expect(tenantId).toBe("tenant-demo");
          expect(email).toBe("owner@demo.example");

          return member;
        }
      }),
      undefined,
      agencyEmailTokens({ consume })
    );

    await expect(
      service.exchangeAgencyMagicLink({
        tenantSlug: "demo-agency",
        token: "magic-token-value-123"
      })
    ).resolves.toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      setupUrl: "/setup?plan=starter",
      tenant: {
        id: "tenant-demo"
      },
      user: {
        id: "owner-user-1"
      }
    });
    expect(consume).toHaveBeenCalledWith({
      purpose: "magic-link",
      tenantId: "tenant-demo",
      token: "magic-token-value-123"
    });
  });

  it("rotates agency refresh tokens and keeps the session scoped to the tenant", async () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    const member = tenantUser({ email: "owner@demo.example", id: "owner-user-1", tenantId: "tenant-demo" });
    const service = new TenantService(
      repository({
        findById: async () => tenant({ id: "tenant-demo", slug: "demo-agency", subscriptionPlan: "starter" }),
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency", subscriptionPlan: "starter" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMember: async (tenantId, userId) => {
          expect(tenantId).toBe("tenant-demo");
          expect(userId).toBe("owner-user-1");

          return member;
        },
        getActiveTenantMemberByEmail: async () => member
      })
    );
    const session = await service.createAgencySession({
      tenantSlug: "demo-agency",
      workEmail: "owner@demo.example"
    });

    const refreshed = await service.refreshAgencySession({
      refreshToken: session.refreshToken,
      tenantId: "tenant-demo"
    });

    expect(refreshed).toMatchObject({
      accessToken: expect.any(String),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.any(String),
      refreshTokenExpiresAt: expect.any(String),
      tenant: {
        id: "tenant-demo"
      },
      user: {
        id: "owner-user-1"
      }
    });
    expect(refreshed.refreshToken).not.toBe(session.refreshToken);
    await expect(
      service.refreshAgencySession({
        refreshToken: session.refreshToken,
        tenantId: "tenant-demo"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokes agency refresh tokens on logout", async () => {
    vi.stubEnv("PROPERTYFLOW_ACCESS_TOKEN_SECRET", "test-secret");
    const member = tenantUser({ email: "owner@demo.example", id: "owner-user-1", tenantId: "tenant-demo" });
    const service = new TenantService(
      repository({
        findById: async () => tenant({ id: "tenant-demo", slug: "demo-agency", subscriptionPlan: "starter" }),
        findBySlug: async () => tenant({ id: "tenant-demo", slug: "demo-agency", subscriptionPlan: "starter" })
      }),
      new AuthIdentityService(),
      userService({
        getActiveTenantMemberByEmail: async () => member
      })
    );
    const session = await service.createAgencySession({
      tenantSlug: "demo-agency",
      workEmail: "owner@demo.example"
    });

    await expect(
      service.logoutAgencySession({
        refreshToken: session.refreshToken,
        tenantId: "tenant-demo"
      })
    ).resolves.toEqual({ revoked: true });
    await expect(
      service.refreshAgencySession({
        refreshToken: session.refreshToken,
        tenantId: "tenant-demo"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("requires the bootstrap code before issuing production agency sessions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPERTYFLOW_BOOTSTRAP_LOGIN_CODE", "expected-code");
    const service = new TenantService(repository(), new AuthIdentityService(), userService());

    await expect(
      service.createAgencySession({
        tenantSlug: "demo-agency",
        workEmail: "owner@demo.example"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects duplicate provisioning slugs", async () => {
    const service = new TenantService(repository({ findBySlug: async () => tenant({ slug: "demo-agency" }) }));

    await expect(
      service.provision({
        agencyName: "Demo Agency",
        subscriptionPlan: "starter",
        workEmail: "owner@example.com"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects provisioning names that cannot produce a workspace slug", async () => {
    const service = new TenantService(repository());

    await expect(
      service.provision({
        agencyName: " агентство ",
        subscriptionPlan: "starter",
        workEmail: ""
      })
    ).rejects.toBeInstanceOf(BadRequestException);
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
    provision: async () => tenant(),
    recordUsage: async () => undefined,
    updateSettings: async () => null,
    ...overrides
  };
}

function userService(overrides: Partial<UserService> = {}): UserService {
  return {
    getActiveAssignableUser: async () => tenantUser(),
    getActiveTenantMember: async () => tenantUser(),
    getActiveTenantMemberByEmail: async () => null,
    listAgents: async () => [],
    ...overrides
  } as UserService;
}

function agencyEmailTokens(overrides: Partial<AgencyEmailTokenService> = {}): AgencyEmailTokenService {
  return {
    consume: async () => agencyEmailToken(),
    issue: async () => ({
      record: agencyEmailToken(),
      token: "magic-token-value"
    }),
    ...overrides
  } as unknown as AgencyEmailTokenService;
}

function agencyEmailToken(overrides: Partial<AgencyEmailTokenRecord> = {}): AgencyEmailTokenRecord {
  return {
    createdAt: new Date("2026-07-31T10:00:00.000Z"),
    email: "owner@demo.example",
    expiresAt: new Date("2026-07-31T10:15:00.000Z"),
    id: "email-token-1",
    metadata: {},
    purpose: "magic-link",
    tenantId: "demo-agency",
    tokenHash: "token-hash",
    ...overrides
  };
}

function tenantUser(overrides: Partial<TenantUserSnapshot> = {}): TenantUserSnapshot {
  return {
    createdAt: "2026-07-20T00:00:00.000Z",
    email: "agent@demo.example",
    id: "agent-demo-1",
    name: "Demo Agent",
    role: "admin",
    status: "active",
    tenantId: "demo-agency",
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
        th: "สวัสดีค่ะ ฉันชื่อ มาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
        zh: "你好！我是安娜，你的 AI 房产顾问。"
      }
    },
    ...overrides
  };
}
