import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import type {
  CreateAgencySessionRequest,
  CreateAgencySessionResponse,
  ExchangeAgencyMagicLinkRequest,
  LogoutAgencySessionRequest,
  LogoutAgencySessionResponse,
  ProvisionTenantRequest,
  ProvisionTenantResponse,
  PublicWidgetConfigResponse,
  PublicWidgetReadiness,
  PublicWidgetReadinessCheck,
  RecordUsageEventRequest,
  RefreshAgencySessionRequest,
  RefreshAgencySessionResponse,
  RequestAgencyMagicLinkRequest,
  RequestAgencyMagicLinkResponse,
  TenantNotificationProviderCheckResponse,
  TenantNotificationProviderConnectRequest,
  TenantNotificationProviderConnectResponse,
  TenantNotificationProviderTestRequest,
  TenantNotificationProviderVerifyRequest,
  TenantLeadQualificationField,
  TenantSnapshot,
  TenantSubscriptionPlan,
  TenantWidgetInstallCheckItem,
  TenantWidgetInstallCheckResponse,
  TenantWidgetLanguage,
  TenantWidgetTone,
  TenantUsageMetric,
  TenantUsageResponse,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
import { getTenantPlanDefinition, supportedLeadQualificationFields } from "@propertyflow/contracts";
import { AuthIdentityService } from "../../shared/auth/auth-identity.service.js";
import { UserService } from "../../users/application/user.service.js";
import { AgencyEmailTokenService } from "./agency-email-token.service.js";
import {
  AGENCY_REFRESH_TOKEN_REPOSITORY,
  type AgencyRefreshTokenRecord,
  type AgencyRefreshTokenRepository,
  type CreateAgencyRefreshTokenInput
} from "../domain/agency-refresh-token.repository.js";
import {
  NOTIFICATION_CONNECTION_TOKEN_REPOSITORY,
  type ConsumeNotificationConnectionTokenInput,
  type CreateNotificationConnectionTokenInput,
  type NotificationConnectionTokenRecord,
  type NotificationConnectionTokenRepository
} from "../domain/notification-connection-token.repository.js";
import { TENANT_REPOSITORY, type TenantRepository } from "../domain/tenant.repository.js";

const agencyAccessTokenTtlSeconds = 15 * 60;
const agencyRefreshTokenTtlDays = 30;
const notificationConnectionTtlMinutes = 15;

@Injectable()
export class TenantService {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(AuthIdentityService) private readonly authIdentity: AuthIdentityService = new AuthIdentityService(),
    @Optional() @Inject(UserService) private readonly users?: UserService,
    @Optional()
    @Inject(AGENCY_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: AgencyRefreshTokenRepository = new InMemoryAgencyRefreshTokenRepository(),
    @Optional()
    @Inject(AgencyEmailTokenService)
    private readonly emailTokens?: AgencyEmailTokenService,
    @Optional()
    @Inject(NOTIFICATION_CONNECTION_TOKEN_REPOSITORY)
    private readonly notificationConnectionTokens: NotificationConnectionTokenRepository = new InMemoryNotificationConnectionTokenRepository()
  ) {}

  async provision(request: ProvisionTenantRequest): Promise<ProvisionTenantResponse> {
    const agencyName = normalizeRequiredText(request.agencyName);
    const emailDomain = request.workEmail?.split("@")[1] ?? "";
    const slug = buildTenantSlug(agencyName) || buildTenantSlug(emailDomain);
    const subscriptionPlan = normalizeSubscriptionPlan(request.subscriptionPlan);

    if (!agencyName) {
      throw new BadRequestException("Agency name is required");
    }

    if (!slug) {
      throw new BadRequestException("Agency name or email domain must include Latin letters or numbers for the workspace slug");
    }

    const existing = await this.tenants.findBySlug(slug);

    if (existing) {
      throw new ConflictException("Agency workspace already exists");
    }

    const ownerUserId = randomUUID();
    const tenant = await this.tenants.provision({
      name: agencyName,
      ownerEmail: normalizeRequiredText(request.workEmail).toLowerCase(),
      ownerName: "Workspace owner",
      ownerUserId,
      slug,
      subscriptionPlan,
      website: normalizeOptionalWebsite(request.website)
    });

    const session = await this.issueAgencySession(tenant, ownerUserId);

    return {
      ...session,
      setupUrl: `/setup?plan=${tenant.subscriptionPlan}`,
      tenant
    };
  }

  async createAgencySession(request: CreateAgencySessionRequest): Promise<CreateAgencySessionResponse> {
    this.assertBootstrapSessionAllowed(request.bootstrapCode);

    const tenant = await this.getActiveTenantBySlugOrThrow(request.tenantSlug, "Agency workspace not found");
    const user = await this.users?.getActiveTenantMemberByEmail(
      tenant.id,
      normalizeRequiredText(request.workEmail).toLowerCase()
    );

    if (!user) {
      throw new NotFoundException("Agency user was not found for this workspace");
    }

    const session = await this.issueAgencySession(tenant, user.id);

    return {
      ...session,
      setupUrl: `/setup?plan=${tenant.subscriptionPlan}`,
      tenant,
      user
    };
  }

  async requestAgencyMagicLink(request: RequestAgencyMagicLinkRequest): Promise<RequestAgencyMagicLinkResponse> {
    const tenant = await this.getActiveTenantBySlugOrThrow(request.tenantSlug, "Agency workspace not found");
    const workEmail = normalizeRequiredText(request.workEmail).toLowerCase();

    if (!workEmail) {
      throw new BadRequestException("Work email is required");
    }

    const user = await this.users?.getActiveTenantMemberByEmail(tenant.id, workEmail);

    if (!user || !this.emailTokens) {
      return buildAcceptedMagicLinkResponse();
    }

    const issued = await this.emailTokens.issue({
      email: workEmail,
      metadata: {
        tenantSlug: tenant.slug,
        userId: user.id
      },
      purpose: "magic-link",
      tenantId: tenant.id
    });

    return buildAcceptedMagicLinkResponse(tenant.slug, issued.record.expiresAt, issued.token);
  }

  async exchangeAgencyMagicLink(request: ExchangeAgencyMagicLinkRequest): Promise<CreateAgencySessionResponse> {
    const tenant = await this.getActiveTenantBySlugOrThrow(request.tenantSlug, "Agency workspace not found");

    if (!this.emailTokens) {
      throw new ForbiddenException("Magic-link exchange is not configured");
    }

    const token = await this.emailTokens.consume({
      purpose: "magic-link",
      tenantId: tenant.id,
      token: normalizeRequiredText(request.token)
    });
    const user = await this.users?.getActiveTenantMemberByEmail(tenant.id, token.email);

    if (!user) {
      throw new UnauthorizedException("Agency magic link is no longer valid");
    }

    const session = await this.issueAgencySession(tenant, user.id);

    return {
      ...session,
      setupUrl: `/setup?plan=${tenant.subscriptionPlan}`,
      tenant,
      user
    };
  }

  async refreshAgencySession(request: RefreshAgencySessionRequest): Promise<RefreshAgencySessionResponse> {
    const refreshToken = normalizeRequiredText(request.refreshToken);
    const tenantId = normalizeRequiredText(request.tenantId);

    if (!refreshToken || !tenantId) {
      throw new UnauthorizedException("Refresh token and tenant are required");
    }

    const now = new Date();
    const current = await this.refreshTokens.findActiveByHash(hashRefreshToken(refreshToken), now);

    if (!current || current.tenantId !== tenantId) {
      throw new UnauthorizedException("Agency refresh session is not valid");
    }

    const tenant = await this.getActiveTenantOrThrow(current.tenantId);
    const user = await this.users?.getActiveTenantMember(current.tenantId, current.userId);

    if (!user) {
      throw new UnauthorizedException("Agency user is no longer active");
    }

    const nextRefreshToken = createRefreshTokenValue();
    const refreshTokenExpiresAt = addDays(now, agencyRefreshTokenTtlDays);
    const rotated = await this.refreshTokens.rotate(current.id, {
      createdAt: now,
      expiresAt: refreshTokenExpiresAt,
      id: randomUUID(),
      tenantId: current.tenantId,
      tokenHash: hashRefreshToken(nextRefreshToken),
      userId: current.userId
    });

    if (!rotated) {
      throw new UnauthorizedException("Agency refresh session was already used");
    }

    const accessTokenExpiresAt = addSeconds(now, agencyAccessTokenTtlSeconds);

    return {
      accessToken: this.authIdentity.issueAccessToken(current.userId, agencyAccessTokenTtlSeconds),
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      tenant,
      user
    };
  }

  async logoutAgencySession(request: LogoutAgencySessionRequest): Promise<LogoutAgencySessionResponse> {
    const refreshToken = normalizeRequiredText(request.refreshToken);
    const tenantId = normalizeRequiredText(request.tenantId);

    if (!refreshToken || !tenantId) {
      throw new UnauthorizedException("Refresh token and tenant are required");
    }

    const now = new Date();
    const current = await this.refreshTokens.findActiveByHash(hashRefreshToken(refreshToken), now);

    if (!current || current.tenantId !== tenantId) {
      throw new UnauthorizedException("Agency refresh session is not valid");
    }

    const revoked = await this.refreshTokens.revoke(current.id, now);

    if (!revoked) {
      throw new UnauthorizedException("Agency refresh session was already revoked");
    }

    return { revoked: true };
  }

  async findActiveTenant(tenantId: string): Promise<TenantSnapshot | null> {
    const tenant = await this.tenants.findById(tenantId);

    if (!tenant || tenant.status !== "active") {
      return null;
    }

    return tenant;
  }

  private async issueAgencySession(tenant: TenantSnapshot, userId: string) {
    const now = new Date();
    const refreshToken = createRefreshTokenValue();
    const accessTokenExpiresAt = addSeconds(now, agencyAccessTokenTtlSeconds);
    const refreshTokenExpiresAt = addDays(now, agencyRefreshTokenTtlDays);

    await this.refreshTokens.create({
      createdAt: now,
      expiresAt: refreshTokenExpiresAt,
      id: randomUUID(),
      tenantId: tenant.id,
      tokenHash: hashRefreshToken(refreshToken),
      userId
    });

    return {
      accessToken: this.authIdentity.issueAccessToken(userId, agencyAccessTokenTtlSeconds),
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString()
    };
  }

  async getActiveTenantOrThrow(tenantId: string): Promise<TenantSnapshot> {
    const tenant = await this.findActiveTenant(tenantId);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async getActiveTenantBySlugOrThrow(slug: string, message = "Tenant not found"): Promise<TenantSnapshot> {
    const tenant = await this.tenants.findBySlug(slug);

    if (!tenant || tenant.status !== "active") {
      throw new NotFoundException(message);
    }

    return tenant;
  }

  async getPublicWidgetConfig(
    slug: string,
    requestOrigin: { origin?: string; referer?: string } = {}
  ): Promise<PublicWidgetConfigResponse> {
    const tenant = await this.getActiveTenantBySlugOrThrow(slug, "Widget tenant not found");
    this.assertPublicWidgetOriginAllowed(tenant, requestOrigin.origin, requestOrigin.referer);
    const listingUrlTemplate = normalizeListingUrlTemplate(tenant.widget.listingUrlTemplate) ?? defaultWidgetListingUrlTemplate;

    return {
      aiName: tenant.widget.aiName,
      aiNames: tenant.widget.aiNames,
      allowedOriginsConfigured: tenant.widget.allowedOrigins.length > 0,
      branding: tenant.branding,
      capabilities: buildPublicWidgetCapabilities(tenant),
      conciergeMode: tenant.subscriptionPlan,
      languages: tenant.widget.languages,
      leadQualificationFields: tenant.widget.leadQualificationFields,
      listingUrlTemplate,
      personaGenders: tenant.widget.personaGenders,
      readiness: buildPublicWidgetReadiness({ ...tenant, widget: { ...tenant.widget, listingUrlTemplate } }),
      tenantSlug: tenant.slug,
      tone: tenant.widget.tone,
      welcomeMessage: tenant.widget.welcomeMessage,
      welcomeMessages: tenant.widget.welcomeMessages
    };
  }

  async getUsage(tenantId: string): Promise<TenantUsageResponse> {
    const tenant = await this.getActiveTenantOrThrow(tenantId);
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const usage = await this.tenants.getUsage(tenantId, periodStart, periodEnd);

    return {
      tenantId,
      subscriptionPlan: tenant.subscriptionPlan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      items: [
        this.toUsageMetric("properties", usage.properties, tenant.limits.properties),
        this.toUsageMetric("agents", usage.agents, tenant.limits.agents),
        this.toUsageMetric("aiCreditsMonthly", usage.aiCreditsMonthly, tenant.limits.aiCreditsMonthly),
        this.toUsageMetric(
          "publicApiRequestsMonthly",
          usage.publicApiRequestsMonthly,
          tenant.limits.publicApiRequestsMonthly
        )
      ],
      generatedAt: now.toISOString()
    };
  }

  async updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot> {
    const tenant = await this.tenants.updateSettings(tenantId, normalizeUpdateTenantSettingsRequest(request));

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  assertPublicWidgetOriginAllowed(tenant: TenantSnapshot, originHeader?: string, refererHeader?: string): void {
    const requestOrigin = normalizeRequestOrigin(originHeader) ?? normalizeRequestOrigin(refererHeader);

    if (!tenant.widget.allowedOrigins.length) {
      if (!requestOrigin && process.env.NODE_ENV !== "production") {
        return;
      }

      if (requestOrigin && process.env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(requestOrigin)) {
        return;
      }

      throw new ForbiddenException("Widget origin is not allowed for this tenant");
    }

    if (!requestOrigin || !tenant.widget.allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenException("Widget origin is not allowed for this tenant");
    }
  }

  recordPublicWidgetAsk(tenant: TenantSnapshot, metadata: Record<string, unknown> = {}): Promise<void> {
    return this.tenants.recordUsage(tenant.id, "public-widget.ask", metadata);
  }

  recordUsageEvent(input: RecordUsageEventRequest): Promise<void> {
    return this.tenants.recordGenericUsage(input);
  }

  async verifyWidgetInstall(tenant: TenantSnapshot, url: string): Promise<TenantWidgetInstallCheckResponse> {
    const checkedAt = new Date().toISOString();
    const parsedUrl = new URL(url);
    const normalizedUrl = parsedUrl.toString();
    const origin = parsedUrl.origin.toLowerCase();
    const allowedOrigin = !tenant.widget.allowedOrigins.length || tenant.widget.allowedOrigins.includes(origin);

    if (!allowedOrigin) {
      return buildWidgetInstallCheckResponse({
        allowedOrigin,
        checkedAt,
        expectedTenantSlug: tenant.slug,
        origin,
        status: "blocked-origin",
        url: normalizedUrl
      });
    }

    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          accept: "text/html"
        }
      });

      if (!response.ok) {
        return buildWidgetInstallCheckResponse({
          allowedOrigin,
          checkedAt,
          expectedTenantSlug: tenant.slug,
          origin,
          pageStatus: response.status,
          status: "unreachable",
          url: normalizedUrl
        });
      }

      const html = await response.text();
      const detectedTenantSlug = detectWidgetTenantSlug(html);
      const hasWidgetScript = hasPropertyFlowWidgetScript(html);

      if (!hasWidgetScript) {
        return buildWidgetInstallCheckResponse({
          allowedOrigin,
          checkedAt,
          expectedTenantSlug: tenant.slug,
          origin,
          status: "missing-widget",
          url: normalizedUrl
        });
      }

      if (detectedTenantSlug && detectedTenantSlug !== tenant.slug) {
        return buildWidgetInstallCheckResponse({
          allowedOrigin,
          checkedAt,
          detectedTenantSlug,
          expectedTenantSlug: tenant.slug,
          origin,
          status: "wrong-tenant",
          url: normalizedUrl
        });
      }

      return buildWidgetInstallCheckResponse({
        allowedOrigin,
        checkedAt,
        detectedTenantSlug,
        expectedTenantSlug: tenant.slug,
        origin,
        status: "verified",
        url: normalizedUrl
      });
    } catch (_error) {
      return buildWidgetInstallCheckResponse({
        allowedOrigin,
        checkedAt,
        expectedTenantSlug: tenant.slug,
        origin,
        status: "unreachable",
        url: normalizedUrl
      });
    }
  }

  async verifyNotificationProvider(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderVerifyRequest
  ): Promise<TenantNotificationProviderCheckResponse> {
    const checkedAt = new Date().toISOString();

    switch (request.provider) {
      case "telegram":
        return this.verifyTelegramProvider(tenant, request, checkedAt);
      case "line":
        return this.verifyLineProvider(tenant, request, checkedAt);
      case "whatsapp":
        return this.verifyWhatsappProvider(tenant, request, checkedAt);
      default:
        return {
          checkedAt,
          error: "Unsupported notification provider.",
          provider: request.provider,
          status: "failed"
        };
    }
  }

  async sendNotificationProviderTest(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderTestRequest
  ): Promise<TenantNotificationProviderCheckResponse> {
    const checkedAt = new Date().toISOString();
    const text = `PropertyFlowAI test notification for ${tenant.branding.displayName || tenant.name}.`;

    switch (request.provider) {
      case "telegram":
        return this.sendTelegramProviderTest(tenant, request, checkedAt, text);
      case "line":
        return this.sendLineProviderTest(tenant, request, checkedAt, text);
      case "whatsapp":
        return this.sendWhatsappProviderTest(tenant, request, checkedAt, text);
      default:
        return {
          checkedAt,
          error: "Unsupported notification provider.",
          provider: request.provider,
          status: "failed"
        };
    }
  }

  async beginNotificationProviderConnection(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderConnectRequest | TenantNotificationProviderConnectRequest["provider"]
  ): Promise<TenantNotificationProviderConnectResponse> {
    const provider = typeof request === "string" ? request : request.provider;
    const webhookUrl = buildNotificationWebhookUrl(provider, tenant.slug);
    await assertPublicNotificationWebhookUrl(webhookUrl);
    let configuredTenant = tenant;
    let webhookVerifyToken: string | undefined;

    if (provider === "telegram") {
      configuredTenant = await this.configureTelegramWebhook(tenant, request, webhookUrl);
    }

    if (provider === "line") {
      configuredTenant = await this.configureLineWebhookCredentials(tenant, request);
    }

    if (provider === "whatsapp") {
      const configured = await this.configureWhatsappWebhookVerification(tenant, request);
      configuredTenant = configured.tenant;
      webhookVerifyToken = configured.webhookVerifyToken;
    }

    const now = new Date();
    await this.notificationConnectionTokens.revokeActiveForTenantProvider(configuredTenant.id, provider, now);
    const expiresAt = addMinutes(now, notificationConnectionTtlMinutes);
    const code = createNotificationConnectionCode();

    await this.notificationConnectionTokens.create({
      code,
      createdAt: now,
      expiresAt,
      id: randomUUID(),
      provider,
      tenantId: configuredTenant.id
    });

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      instructions: buildNotificationConnectionInstructions(provider, code),
      provider,
      webhookVerifyToken,
      webhookUrl
    };
  }

  async confirmNotificationProviderConnection(
    input: ConsumeNotificationConnectionTokenInput
  ): Promise<TenantNotificationProviderCheckResponse> {
    const consumedAt = input.consumedAt;
    const record = await this.notificationConnectionTokens.consume(input);

    if (!record) {
      return {
        checkedAt: consumedAt.toISOString(),
        error: "Connection code is expired, already used, or belongs to another provider.",
        provider: input.provider,
        status: "failed"
      };
    }

    const tenant = await this.getActiveTenantOrThrow(record.tenantId);
    const alreadyConnected = await this.appendNotificationRecipient(tenant, record);

    return {
      alreadyConnected,
      checkedAt: consumedAt.toISOString(),
      displayName: input.recipientLabel || input.recipientId,
      provider: input.provider,
      status: "connected"
    };
  }

  private toUsageMetric(key: TenantUsageMetric["key"], used: number, limit: number): TenantUsageMetric {
    return {
      key,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      utilizationRate: limit > 0 ? Math.round((used / limit) * 10_000) / 100 : 0
    };
  }

  private assertBootstrapSessionAllowed(bootstrapCode?: string): void {
    const expectedCode = process.env.PROPERTYFLOW_BOOTSTRAP_LOGIN_CODE;

    if (expectedCode && bootstrapCode === expectedCode) {
      return;
    }

    if (!expectedCode && process.env.NODE_ENV !== "production") {
      return;
    }

    throw new ForbiddenException("Agency session exchange is not configured");
  }

  private async verifyTelegramProvider(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderVerifyRequest,
    checkedAt: string
  ): Promise<TenantNotificationProviderCheckResponse> {
    const token = normalizeSecretInput(request.telegramBotToken) ?? tenant.widget.leadTelegramBotToken;

    if (!token) {
      return missingCredentials("telegram", checkedAt, "Paste a Telegram bot token before verifying.");
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const body = (await response.json().catch(() => null)) as TelegramGetMeResponse | null;

      if (!response.ok || !body?.ok) {
        return failedProvider("telegram", checkedAt, "Telegram rejected this bot token.");
      }

      if (normalizeSecretInput(request.telegramBotToken)) {
        await this.updateNotificationCredentials(tenant, {
          leadTelegramBotToken: token
        });
      }

      return {
        checkedAt,
        displayName: body.result.username ? `@${body.result.username}` : body.result.first_name,
        provider: "telegram",
        status: "connected"
      };
    } catch (error) {
      return failedProvider("telegram", checkedAt, toErrorMessage(error));
    }
  }

  private async configureTelegramWebhook(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderConnectRequest | TenantNotificationProviderConnectRequest["provider"],
    webhookUrl: string
  ): Promise<TenantSnapshot> {
    const tokenFromRequest = typeof request === "string" ? undefined : normalizeSecretInput(request.telegramBotToken);
    const token = tokenFromRequest ?? tenant.widget.leadTelegramBotToken;

    if (!token) {
      throw new BadRequestException("Paste a Telegram bot token before connecting a recipient.");
    }

    const secret = createNotificationWebhookSecret();
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        allowed_updates: ["message", "channel_post"],
        drop_pending_updates: false,
        secret_token: secret,
        url: webhookUrl
      })
    });
    const body = (await response.json().catch(() => null)) as TelegramSetWebhookResponse | null;

    if (!response.ok || body?.ok === false) {
      throw new BadRequestException(body?.description || "Telegram rejected webhook setup for this bot token.");
    }

    return this.updateNotificationCredentials(tenant, {
      leadTelegramBotToken: token,
      leadTelegramWebhookSecret: secret
    });
  }

  private async verifyLineProvider(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderVerifyRequest,
    checkedAt: string
  ): Promise<TenantNotificationProviderCheckResponse> {
    const token = normalizeSecretInput(request.lineChannelAccessToken) ?? tenant.widget.leadLineChannelAccessToken;

    if (!token) {
      return missingCredentials("line", checkedAt, "Paste a LINE channel access token before verifying.");
    }

    try {
      const response = await fetch("https://api.line.me/v2/bot/info", {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const body = (await response.json().catch(() => null)) as LineBotInfoResponse | null;

      if (!response.ok) {
        return failedProvider("line", checkedAt, "LINE rejected this channel access token.");
      }

      if (normalizeSecretInput(request.lineChannelAccessToken)) {
        await this.updateNotificationCredentials(tenant, {
          leadLineChannelAccessToken: token
        });
      }

      return {
        checkedAt,
        displayName: body?.displayName,
        provider: "line",
        status: "connected"
      };
    } catch (error) {
      return failedProvider("line", checkedAt, toErrorMessage(error));
    }
  }

  private async configureLineWebhookCredentials(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderConnectRequest | TenantNotificationProviderConnectRequest["provider"]
  ): Promise<TenantSnapshot> {
    const tokenFromRequest = typeof request === "string" ? undefined : normalizeSecretInput(request.lineChannelAccessToken);
    const secretFromRequest = typeof request === "string" ? undefined : normalizeSecretInput(request.lineChannelSecret);
    const token = tokenFromRequest ?? tenant.widget.leadLineChannelAccessToken;
    const secret = secretFromRequest ?? tenant.widget.leadLineChannelSecret;

    if (!token || !secret) {
      throw new BadRequestException("Paste a LINE channel access token and channel secret before connecting a recipient.");
    }

    if (!tokenFromRequest && !secretFromRequest) {
      return tenant;
    }

    return this.updateNotificationCredentials(tenant, {
      leadLineChannelAccessToken: token,
      leadLineChannelSecret: secret
    });
  }

  private async configureWhatsappWebhookVerification(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderConnectRequest | TenantNotificationProviderConnectRequest["provider"]
  ): Promise<{ tenant: TenantSnapshot; webhookVerifyToken: string }> {
    const accessToken =
      typeof request === "string" ? tenant.widget.leadWhatsappAccessToken : normalizeSecretInput(request.whatsappAccessToken) ?? tenant.widget.leadWhatsappAccessToken;
    const appSecret =
      typeof request === "string" ? tenant.widget.leadWhatsappAppSecret : normalizeSecretInput(request.whatsappAppSecret) ?? tenant.widget.leadWhatsappAppSecret;
    const phoneNumberId =
      typeof request === "string" ? tenant.widget.leadWhatsappPhoneNumberId : normalizeSecretInput(request.whatsappPhoneNumberId) ?? tenant.widget.leadWhatsappPhoneNumberId;
    const graphVersion =
      typeof request === "string"
        ? tenant.widget.leadWhatsappGraphApiVersion
        : normalizeGraphApiVersionInput(request.whatsappGraphApiVersion ?? tenant.widget.leadWhatsappGraphApiVersion);
    const existingToken = tenant.widget.leadWhatsappWebhookVerifyToken?.trim();

    if (existingToken && !hasWhatsappConnectCredentialUpdate(tenant, request)) {
      return {
        tenant,
        webhookVerifyToken: existingToken
      };
    }

    const webhookVerifyToken = existingToken || createNotificationWebhookSecret();
    const updated = await this.updateNotificationCredentials(tenant, {
      ...(accessToken ? { leadWhatsappAccessToken: accessToken } : {}),
      ...(appSecret ? { leadWhatsappAppSecret: appSecret } : {}),
      ...(phoneNumberId ? { leadWhatsappPhoneNumberId: phoneNumberId } : {}),
      leadWhatsappGraphApiVersion: graphVersion || "v20.0",
      leadWhatsappWebhookVerifyToken: webhookVerifyToken
    });

    return {
      tenant: updated,
      webhookVerifyToken
    };
  }

  private async verifyWhatsappProvider(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderVerifyRequest,
    checkedAt: string
  ): Promise<TenantNotificationProviderCheckResponse> {
    const token = normalizeSecretInput(request.whatsappAccessToken) ?? tenant.widget.leadWhatsappAccessToken;
    const phoneNumberId = normalizeSecretInput(request.whatsappPhoneNumberId) ?? tenant.widget.leadWhatsappPhoneNumberId;
    const graphVersion = normalizeGraphApiVersionInput(request.whatsappGraphApiVersion ?? tenant.widget.leadWhatsappGraphApiVersion);

    if (!token || !phoneNumberId) {
      return missingCredentials("whatsapp", checkedAt, "Paste a WhatsApp access token and phone number ID before verifying.");
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        {
          headers: {
            authorization: `Bearer ${token}`
          }
        }
      );
      const body = (await response.json().catch(() => null)) as WhatsappPhoneNumberInfoResponse | null;

      if (!response.ok) {
        return failedProvider("whatsapp", checkedAt, "WhatsApp Cloud API rejected these credentials.");
      }

      if (
        normalizeSecretInput(request.whatsappAccessToken) ||
        normalizeSecretInput(request.whatsappPhoneNumberId) ||
        request.whatsappGraphApiVersion
      ) {
        await this.updateNotificationCredentials(tenant, {
          leadWhatsappAccessToken: token,
          leadWhatsappGraphApiVersion: graphVersion,
          leadWhatsappPhoneNumberId: phoneNumberId
        });
      }

      return {
        checkedAt,
        displayName: body?.verified_name ?? body?.display_phone_number,
        provider: "whatsapp",
        status: "connected"
      };
    } catch (error) {
      return failedProvider("whatsapp", checkedAt, toErrorMessage(error));
    }
  }

  private async updateNotificationCredentials(tenant: TenantSnapshot, widget: UpdateTenantSettingsRequest["widget"]): Promise<TenantSnapshot> {
    const updated = await this.tenants.updateSettings(tenant.id, { widget });

    if (!updated) {
      throw new NotFoundException("Agency workspace was not found");
    }

    return updated;
  }

  private async sendTelegramProviderTest(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderTestRequest,
    checkedAt: string,
    text: string
  ): Promise<TenantNotificationProviderCheckResponse> {
    const token = normalizeSecretInput(request.telegramBotToken) ?? tenant.widget.leadTelegramBotToken;
    const chatIds = request.telegramChatIds?.length ? request.telegramChatIds : tenant.widget.leadTelegramChatIds ?? [];

    if (!token) {
      return missingCredentials("telegram", checkedAt, "Paste a Telegram bot token before sending a test.");
    }

    if (!chatIds.length) {
      return missingRecipient("telegram", checkedAt, "Add at least one Telegram chat ID before sending a test.");
    }

    return this.postProviderTest(
      "telegram",
      checkedAt,
      chatIds.map((chatId) => ({
        body: { chat_id: chatId, disable_web_page_preview: true, text },
        headers: { "content-type": "application/json" },
        url: `https://api.telegram.org/bot${token}/sendMessage`
      }))
    );
  }

  private async sendLineProviderTest(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderTestRequest,
    checkedAt: string,
    text: string
  ): Promise<TenantNotificationProviderCheckResponse> {
    const token = normalizeSecretInput(request.lineChannelAccessToken) ?? tenant.widget.leadLineChannelAccessToken;
    const recipientIds = request.lineRecipientIds?.length ? request.lineRecipientIds : tenant.widget.leadLineRecipientIds ?? [];

    if (!token) {
      return missingCredentials("line", checkedAt, "Paste a LINE channel access token before sending a test.");
    }

    if (!recipientIds.length) {
      return missingRecipient("line", checkedAt, "Add at least one LINE recipient ID before sending a test.");
    }

    return this.postProviderTest(
      "line",
      checkedAt,
      recipientIds.map((recipientId) => ({
        body: { messages: [{ text, type: "text" }], to: recipientId },
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        url: "https://api.line.me/v2/bot/message/push"
      }))
    );
  }

  private async sendWhatsappProviderTest(
    tenant: TenantSnapshot,
    request: TenantNotificationProviderTestRequest,
    checkedAt: string,
    text: string
  ): Promise<TenantNotificationProviderCheckResponse> {
    const token = normalizeSecretInput(request.whatsappAccessToken) ?? tenant.widget.leadWhatsappAccessToken;
    const phoneNumberId = normalizeSecretInput(request.whatsappPhoneNumberId) ?? tenant.widget.leadWhatsappPhoneNumberId;
    const graphVersion = normalizeGraphApiVersionInput(request.whatsappGraphApiVersion ?? tenant.widget.leadWhatsappGraphApiVersion);
    const recipients = request.whatsappRecipients?.length ? request.whatsappRecipients : tenant.widget.leadWhatsappRecipients ?? [];

    if (!token || !phoneNumberId) {
      return missingCredentials("whatsapp", checkedAt, "Paste WhatsApp Cloud API credentials before sending a test.");
    }

    if (!recipients.length) {
      return missingRecipient("whatsapp", checkedAt, "Add at least one WhatsApp recipient before sending a test.");
    }

    return this.postProviderTest(
      "whatsapp",
      checkedAt,
      recipients.map((recipient) => ({
        body: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          text: { body: text, preview_url: false },
          to: recipient,
          type: "text"
        },
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        url: `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`
      }))
    );
  }

  private async postProviderTest(
    provider: TenantNotificationProviderTestRequest["provider"],
    checkedAt: string,
    requests: Array<{ body: unknown; headers: Record<string, string>; url: string }>
  ): Promise<TenantNotificationProviderCheckResponse> {
    try {
      const responses = await Promise.all(
        requests.map((request) =>
          fetch(request.url, {
            method: "POST",
            headers: request.headers,
            body: JSON.stringify(request.body)
          })
        )
      );
      const failed = responses.find((response) => !response.ok);

      if (failed) {
        return failedProvider(provider, checkedAt, `Test message failed with HTTP ${failed.status}.`);
      }

      return {
        checkedAt,
        provider,
        status: "connected"
      };
    } catch (error) {
      return failedProvider(provider, checkedAt, toErrorMessage(error));
    }
  }

  private async appendNotificationRecipient(
    tenant: TenantSnapshot,
    record: NotificationConnectionTokenRecord
  ): Promise<boolean> {
    const recipientId = record.recipientId?.trim();

    if (!recipientId) {
      return false;
    }

    if (record.provider === "telegram") {
      const current = tenant.widget.leadTelegramChatIds ?? [];
      const alreadyConnected = current.includes(recipientId);

      await this.updateSettings(tenant.id, {
        widget: {
          leadTelegramChatIds: appendUnique(current, recipientId)
        }
      });

      return alreadyConnected;
    }

    if (record.provider === "line") {
      const current = tenant.widget.leadLineRecipientIds ?? [];
      const alreadyConnected = current.includes(recipientId);

      await this.updateSettings(tenant.id, {
        widget: {
          leadLineRecipientIds: appendUnique(current, recipientId)
        }
      });

      return alreadyConnected;
    }

    if (record.provider === "whatsapp") {
      const current = tenant.widget.leadWhatsappRecipients ?? [];
      const alreadyConnected = current.includes(recipientId);

      await this.updateSettings(tenant.id, {
        widget: {
          leadWhatsappRecipients: appendUnique(current, recipientId)
        }
      });

      return alreadyConnected;
    }

    return false;
  }
}

function hasPropertyFlowWidgetScript(html: string) {
  return /<script\b[^>]*\bsrc=["'][^"']*(?:propertyflow\.ai\/widget\.js|\/widget\.js)[^"']*["'][^>]*>/i.test(html);
}

function detectWidgetTenantSlug(html: string) {
  const match = html.match(/\bdata-tenant=["']([^"']+)["']/i);

  return match?.[1];
}

function buildPublicWidgetReadiness(tenant: TenantSnapshot): PublicWidgetReadiness {
  const enabledLanguages = tenant.widget.languages;
  const hasLocalizedWelcome = enabledLanguages.every((language) =>
    Boolean(tenant.widget.welcomeMessages[language]?.trim())
  );
  const checks: PublicWidgetReadinessCheck[] = [
    {
      key: "origin-policy",
      label: "Origin policy",
      note: tenant.widget.allowedOrigins.length
        ? "Website origins are explicitly allowed for production installs."
        : "No origin allowlist is configured yet, so the widget is still in test mode.",
      ready: tenant.widget.allowedOrigins.length > 0
    },
    {
      key: "languages",
      label: "Languages",
      note: enabledLanguages.length
        ? `${enabledLanguages.length} locale${enabledLanguages.length === 1 ? "" : "s"} enabled for the launcher.`
        : "Enable at least one supported widget language.",
      ready: enabledLanguages.length > 0
    },
    {
      key: "localized-welcome",
      label: "Localized welcome",
      note: hasLocalizedWelcome
        ? "Every enabled language has a welcome message."
        : "Add a welcome message for every enabled language.",
      ready: enabledLanguages.length > 0 && hasLocalizedWelcome
    },
    {
      key: "listing-url-template",
      label: "Listing links",
      note: tenant.widget.listingUrlTemplate.includes(":propertyId")
        ? `Recommended listings open with ${tenant.widget.listingUrlTemplate}.`
        : "Add a listing URL route with :propertyId.",
      ready: tenant.widget.listingUrlTemplate.includes(":propertyId")
    }
  ];
  const status: PublicWidgetReadiness["status"] = checks.some((check) => check.key !== "origin-policy" && !check.ready)
    ? "needs-setup"
    : checks.every((check) => check.ready)
      ? "ready"
      : "test-mode";
  const nextActions: Record<PublicWidgetReadiness["status"], string> = {
    "needs-setup": "Finish language and localized welcome settings before installing the widget.",
    ready: "Widget configuration is ready for production installation.",
    "test-mode": "Add production website origins before sharing the widget with live visitors."
  };

  return {
    checks,
    nextAction: nextActions[status],
    status
  };
}

function buildPublicWidgetCapabilities(tenant: TenantSnapshot): PublicWidgetConfigResponse["capabilities"] {
  const plan = getTenantPlanDefinition(tenant.subscriptionPlan);

  return {
    crmLeadCapture: plan.features.crmLeadCapture,
    knowledgeAnswers: plan.features.knowledgeBase,
    leadCapture: plan.features.leadQualification || plan.features.crmLeadCapture,
    leadQualification: plan.features.leadQualification,
    propertySearch: plan.features.propertySearch
  };
}

function buildWidgetInstallCheckResponse(input: {
  allowedOrigin: boolean;
  checkedAt: string;
  detectedTenantSlug?: string;
  expectedTenantSlug: string;
  origin: string;
  pageStatus?: number;
  status: TenantWidgetInstallCheckResponse["status"];
  url: string;
}): TenantWidgetInstallCheckResponse {
  const messages: Record<TenantWidgetInstallCheckResponse["status"], string> = {
    "blocked-origin": `Add ${input.origin} to allowed website origins before using this widget there.`,
    "missing-widget": "PropertyFlow widget script was not found on this page.",
    unreachable: input.pageStatus
      ? `The page responded with HTTP ${input.pageStatus}. Check that the URL is public and reachable.`
      : "Could not reach this page. Check the URL or try again after the site is deployed.",
    verified: "Widget script is installed and points to this agency workspace.",
    "wrong-tenant": `Widget is installed, but it points to ${input.detectedTenantSlug} instead of ${input.expectedTenantSlug}.`
  };
  const nextActions: Record<TenantWidgetInstallCheckResponse["status"], string> = {
    "blocked-origin": "Add this origin in Widget website origins, then run the check again.",
    "missing-widget": "Paste the widget snippet before the closing body tag or into the agency tag manager.",
    unreachable: "Use a public page URL that returns HTML, then run the check again.",
    verified: "Open the page and confirm the launcher appears in each enabled language.",
    "wrong-tenant": "Replace the snippet with the current workspace snippet from this settings page."
  };

  return {
    allowedOrigin: input.allowedOrigin,
    checkedAt: input.checkedAt,
    checks: buildWidgetInstallChecks(input),
    detectedTenantSlug: input.detectedTenantSlug,
    expectedTenantSlug: input.expectedTenantSlug,
    message: messages[input.status],
    nextAction: nextActions[input.status],
    origin: input.origin,
    status: input.status,
    url: input.url
  };
}

function buildWidgetInstallChecks(input: {
  allowedOrigin: boolean;
  detectedTenantSlug?: string;
  expectedTenantSlug: string;
  status: TenantWidgetInstallCheckResponse["status"];
}): TenantWidgetInstallCheckItem[] {
  return [
    {
      key: "origin",
      label: "Origin allowlist",
      note: input.allowedOrigin ? "This website origin can use the widget." : "This website origin is not allowed yet.",
      status: input.allowedOrigin ? "passed" : "failed"
    },
    {
      key: "page",
      label: "Page reachable",
      note: input.status === "unreachable" ? "The install check could not read a public HTML page." : "The page can be checked.",
      status: input.status === "blocked-origin" ? "warning" : input.status === "unreachable" ? "failed" : "passed"
    },
    {
      key: "script",
      label: "Widget script",
      note: input.status === "missing-widget" ? "No PropertyFlow widget script was found." : "Widget script is present.",
      status:
        input.status === "blocked-origin" || input.status === "unreachable"
          ? "warning"
          : input.status === "missing-widget"
            ? "failed"
            : "passed"
    },
    {
      key: "tenant",
      label: "Tenant key",
      note:
        input.status === "wrong-tenant"
          ? `Detected ${input.detectedTenantSlug}; expected ${input.expectedTenantSlug}.`
          : `Expected tenant ${input.expectedTenantSlug}.`,
      status:
        input.status === "blocked-origin" || input.status === "unreachable" || input.status === "missing-widget"
          ? "warning"
          : input.status === "wrong-tenant"
            ? "failed"
            : "passed"
    }
  ];
}

const supportedWidgetLanguages: TenantWidgetLanguage[] = ["en", "ru", "th", "zh"];
const supportedPersonaGenders = ["feminine", "masculine", "neutral"] as const;
const supportedWidgetTones: TenantWidgetTone[] = ["friendly", "professional", "luxury", "concise"];
const supportedSubscriptionPlans: TenantSubscriptionPlan[] = ["starter", "growth", "enterprise"];
const defaultWidgetListingUrlTemplate = "/listings/:propertyId";

function normalizeRequiredText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function createRefreshTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function buildAcceptedMagicLinkResponse(tenantSlug?: string, expiresAt?: Date, token?: string): RequestAgencyMagicLinkResponse {
  const includeDevelopmentToken = process.env.NODE_ENV !== "production" && token;
  const response: RequestAgencyMagicLinkResponse = {
    accepted: true,
    delivery: "email",
    message: "If this workspace user exists, a secure sign-in link will be sent to the work email."
  };

  if (includeDevelopmentToken) {
    response.developmentToken = token;
    response.developmentMagicLinkUrl = buildAgencyMagicLinkUrl(tenantSlug, token);
  }

  if (expiresAt) {
    response.expiresAt = expiresAt.toISOString();
  }

  return response;
}

function buildAgencyMagicLinkUrl(tenantSlug: string | undefined, token: string): string {
  const baseUrl = (process.env.AGENCY_APP_BASE_URL ?? "http://localhost:3002").replace(/\/+$/, "");
  const url = new URL("/signin/magic", baseUrl);

  url.searchParams.set("token", token);

  if (tenantSlug) {
    url.searchParams.set("workspace", tenantSlug);
  }

  return url.toString();
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

class InMemoryAgencyRefreshTokenRepository implements AgencyRefreshTokenRepository {
  private readonly records = new Map<string, AgencyRefreshTokenRecord>();

  async create(input: CreateAgencyRefreshTokenInput) {
    const record = toRefreshRecord(input);

    this.records.set(record.id, record);

    return record;
  }

  async findActiveByHash(tokenHash: string, now: Date) {
    return (
      Array.from(this.records.values()).find(
        (record) => record.tokenHash === tokenHash && !record.revokedAt && record.expiresAt > now
      ) ?? null
    );
  }

  async rotate(currentTokenId: string, input: CreateAgencyRefreshTokenInput) {
    const current = this.records.get(currentTokenId);

    if (!current || current.revokedAt) {
      return null;
    }

    const next = toRefreshRecord(input);

    current.revokedAt = input.createdAt;
    current.replacedByTokenId = next.id;
    this.records.set(next.id, next);

    return next;
  }

  async revoke(currentTokenId: string, revokedAt: Date) {
    const current = this.records.get(currentTokenId);

    if (!current || current.revokedAt) {
      return false;
    }

    current.revokedAt = revokedAt;

    return true;
  }
}

class InMemoryNotificationConnectionTokenRepository implements NotificationConnectionTokenRepository {
  readonly records = new Map<string, NotificationConnectionTokenRecord>();

  async create(input: CreateNotificationConnectionTokenInput): Promise<NotificationConnectionTokenRecord> {
    const record: NotificationConnectionTokenRecord = {
      code: input.code,
      consumedAt: null,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      id: input.id,
      provider: input.provider,
      recipientId: null,
      recipientLabel: null,
      tenantId: input.tenantId
    };

    this.records.set(record.id, record);

    return record;
  }

  async consume(input: ConsumeNotificationConnectionTokenInput): Promise<NotificationConnectionTokenRecord | null> {
    const record = Array.from(this.records.values()).find(
      (item) =>
        item.code === input.code &&
        item.provider === input.provider &&
        !item.consumedAt &&
        item.expiresAt > input.consumedAt
    );

    if (!record) {
      return null;
    }

    record.consumedAt = input.consumedAt;
    record.recipientId = input.recipientId;
    record.recipientLabel = input.recipientLabel ?? null;

    return record;
  }

  async revokeActiveForTenantProvider(
    tenantId: string,
    provider: TenantNotificationProviderVerifyRequest["provider"],
    revokedAt: Date
  ): Promise<number> {
    let count = 0;

    this.records.forEach((record) => {
      if (record.tenantId === tenantId && record.provider === provider && !record.consumedAt && record.expiresAt > revokedAt) {
        record.consumedAt = revokedAt;
        count += 1;
      }
    });

    return count;
  }
}

function toRefreshRecord(input: CreateAgencyRefreshTokenInput): AgencyRefreshTokenRecord {
  return {
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    id: input.id,
    replacedByTokenId: null,
    revokedAt: null,
    tenantId: input.tenantId,
    tokenHash: input.tokenHash,
    userId: input.userId
  };
}

function buildTenantSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeSubscriptionPlan(plan: TenantSubscriptionPlan | undefined): TenantSubscriptionPlan {
  return plan && supportedSubscriptionPlans.includes(plan) ? plan : "starter";
}

function createNotificationConnectionCode(): string {
  const digits = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

  return `PF-${digits}`;
}

function createNotificationWebhookSecret(): string {
  return randomBytes(32).toString("base64url");
}

function buildNotificationConnectionInstructions(
  provider: TenantNotificationProviderVerifyRequest["provider"],
  code: string
): string[] {
  const message = `Send ${code} to this agency ${providerLabel(provider)} bot.`;

  if (provider === "telegram") {
    return ["Open the agency Telegram bot.", message, "PropertyFlowAI will save the chat automatically after the bot receives the code."];
  }

  if (provider === "line") {
    return ["Add the agency LINE Official Account as a friend.", message, "PropertyFlowAI will save the LINE user or group automatically after the bot receives the code."];
  }

  return ["Open a WhatsApp chat with the agency business number.", message, "PropertyFlowAI will save the WhatsApp recipient automatically after the business account receives the code."];
}

function buildNotificationWebhookUrl(provider: TenantNotificationProviderVerifyRequest["provider"], tenantSlug: string): string {
  const baseUrl = (process.env.PROPERTYFLOW_API_PUBLIC_URL ?? process.env.PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001").replace(
    /\/+$/,
    ""
  );

  return `${baseUrl}/public/v1/notifications/${provider}/${tenantSlug}`;
}

async function assertPublicNotificationWebhookUrl(webhookUrl: string): Promise<void> {
  let url: URL;

  try {
    url = new URL(webhookUrl);
  } catch (_error) {
    throw new BadRequestException("Set PROPERTYFLOW_API_PUBLIC_URL to a valid public HTTPS URL before connecting messenger webhooks.");
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");

  if (url.protocol !== "https:" || isLocalHost) {
    throw new BadRequestException(
      "Messenger webhooks require PROPERTYFLOW_API_PUBLIC_URL to be a public HTTPS URL. If you use a tunnel, update PROPERTYFLOW_API_PUBLIC_URL and restart the API after the tunnel URL changes."
    );
  }

  try {
    await lookup(url.hostname);
  } catch (_error) {
    throw new BadRequestException(
      "Messenger webhook host cannot be resolved from the public internet. If you use a tunnel, update PROPERTYFLOW_API_PUBLIC_URL with the active tunnel URL and restart the API."
    );
  }
}

function providerLabel(provider: TenantNotificationProviderVerifyRequest["provider"]): string {
  const labels: Record<TenantNotificationProviderVerifyRequest["provider"], string> = {
    line: "LINE",
    telegram: "Telegram",
    whatsapp: "WhatsApp"
  };

  return labels[provider];
}

function appendUnique(values: string[], value: string): string[] {
  return Array.from(new Set([...values, value].map((item) => item.trim()).filter(Boolean))).slice(0, 10);
}

function hasWhatsappConnectCredentialUpdate(
  tenant: TenantSnapshot,
  request: TenantNotificationProviderConnectRequest | TenantNotificationProviderConnectRequest["provider"]
): boolean {
  if (typeof request === "string") {
    return false;
  }

  const accessToken = normalizeSecretInput(request.whatsappAccessToken);
  const appSecret = normalizeSecretInput(request.whatsappAppSecret);
  const phoneNumberId = normalizeSecretInput(request.whatsappPhoneNumberId);
  const graphVersion = normalizeGraphApiVersionInput(request.whatsappGraphApiVersion ?? tenant.widget.leadWhatsappGraphApiVersion);

  return Boolean(
    (accessToken && accessToken !== tenant.widget.leadWhatsappAccessToken) ||
      (appSecret && appSecret !== tenant.widget.leadWhatsappAppSecret) ||
      (phoneNumberId && phoneNumberId !== tenant.widget.leadWhatsappPhoneNumberId) ||
      graphVersion !== (tenant.widget.leadWhatsappGraphApiVersion ?? "v20.0")
  );
}

interface TelegramGetMeResponse {
  ok: boolean;
  result: {
    first_name?: string;
    username?: string;
  };
}

interface TelegramSetWebhookResponse {
  description?: string;
  ok: boolean;
}

interface LineBotInfoResponse {
  displayName?: string;
}

interface WhatsappPhoneNumberInfoResponse {
  display_phone_number?: string;
  verified_name?: string;
}

function missingCredentials(
  provider: TenantNotificationProviderVerifyRequest["provider"],
  checkedAt: string,
  error: string
): TenantNotificationProviderCheckResponse {
  return {
    checkedAt,
    error,
    provider,
    status: "missing-credentials"
  };
}

function missingRecipient(
  provider: TenantNotificationProviderVerifyRequest["provider"],
  checkedAt: string,
  error: string
): TenantNotificationProviderCheckResponse {
  return {
    checkedAt,
    error,
    provider,
    status: "missing-recipient"
  };
}

function failedProvider(
  provider: TenantNotificationProviderVerifyRequest["provider"],
  checkedAt: string,
  error: string
): TenantNotificationProviderCheckResponse {
  return {
    checkedAt,
    error,
    provider,
    status: "failed"
  };
}

function normalizeSecretInput(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed || undefined;
}

function normalizeGraphApiVersionInput(value: string | undefined): string {
  const version = value?.trim();

  return version && /^v\d+\.\d+$/.test(version) ? version : "v20.0";
}

function normalizeOptionalWebsite(value: string | undefined): string | undefined {
  const website = value?.trim();

  if (!website) {
    return undefined;
  }

  try {
    return new URL(website).origin.toLowerCase();
  } catch (_error) {
    return undefined;
  }
}

function normalizeUpdateTenantSettingsRequest(request: UpdateTenantSettingsRequest): UpdateTenantSettingsRequest {
  const languages = request.widget?.languages
    ?.map((language) => language.trim().toLowerCase())
    .filter((language, index, values): language is TenantWidgetLanguage =>
      supportedWidgetLanguages.includes(language as TenantWidgetLanguage) && values.indexOf(language) === index
    );
  const aiNames = normalizeLocalizedStrings(request.widget?.aiNames);
  const welcomeMessages = normalizeLocalizedStrings(request.widget?.welcomeMessages);
  const personaGenders = normalizePersonaGenders(request.widget?.personaGenders);
  const allowedOrigins = normalizeAllowedOrigins(request.widget?.allowedOrigins);
  const leadQualificationFields = normalizeLeadQualificationFields(request.widget?.leadQualificationFields);
  const listingUrlTemplate = normalizeListingUrlTemplate(request.widget?.listingUrlTemplate);

  return {
    ...request,
    widget: request.widget
      ? {
          ...request.widget,
          aiName: request.widget.aiName?.trim() || undefined,
          aiNames,
          allowedOrigins,
          languages: languages?.length ? languages : undefined,
          leadQualificationFields,
          listingUrlTemplate,
          personaGenders,
          tone: normalizeWidgetTone(request.widget.tone),
          welcomeMessage: request.widget.welcomeMessage?.trim() || welcomeMessages?.en || undefined,
          welcomeMessages
        }
      : undefined
  };
}

function normalizeAllowedOrigins(origins: string[] | undefined) {
  if (!origins) {
    return undefined;
  }

  return origins
    .map((origin) => normalizeRequestOrigin(origin))
    .filter((origin, index, values): origin is string => Boolean(origin) && values.indexOf(origin) === index);
}

function normalizeLeadQualificationFields(fields: TenantLeadQualificationField[] | undefined) {
  if (!fields) {
    return undefined;
  }

  return fields.filter((field, index, values) => supportedLeadQualificationFields.includes(field) && values.indexOf(field) === index);
}

function normalizeListingUrlTemplate(value: string | undefined): string | undefined {
  const template = value?.trim();

  if (!template) {
    return undefined;
  }

  if (!template.startsWith("/") || template.startsWith("//") || !template.includes(":propertyId")) {
    return undefined;
  }

  return template.slice(0, 160);
}

function normalizeRequestOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.origin.toLowerCase();
  } catch (_error) {
    return undefined;
  }
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();

    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch (_error) {
    return false;
  }
}

function normalizeWidgetTone(tone: TenantWidgetTone | undefined) {
  return tone && supportedWidgetTones.includes(tone) ? tone : undefined;
}

function normalizeLocalizedStrings(values: Partial<Record<TenantWidgetLanguage, string>> | undefined) {
  if (!values) {
    return undefined;
  }

  return supportedWidgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, string>>>((normalized, language) => {
    const value = values[language]?.trim();

    if (value) {
      normalized[language] = value;
    }

    return normalized;
  }, {});
}

function normalizePersonaGenders(
  values: Partial<Record<TenantWidgetLanguage, (typeof supportedPersonaGenders)[number]>> | undefined
) {
  if (!values) {
    return undefined;
  }

  return supportedWidgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, (typeof supportedPersonaGenders)[number]>>>(
    (normalized, language) => {
      const value = values[language];

      if (supportedPersonaGenders.includes(value as (typeof supportedPersonaGenders)[number])) {
        normalized[language] = value;
      }

      return normalized;
    },
    {}
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
