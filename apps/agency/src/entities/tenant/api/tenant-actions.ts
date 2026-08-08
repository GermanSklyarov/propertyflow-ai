"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  TenantLeadQualificationField,
  TenantNotificationProvider,
  TenantNotificationProviderCheckResponse,
  TenantNotificationProviderConnectResponse,
  TenantWidgetLanguage,
  TenantWidgetTone
} from "@propertyflow/contracts";
import { supportedLeadQualificationFields } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";
import { normalizeWidgetListingUrlTemplate } from "@entities/tenant/model/widget-listing-links";
import {
  beginNotificationProviderConnection,
  sendNotificationProviderTest,
  updateTenantSettings,
  verifyNotificationProvider
} from "@shared/api/agency-client";
import { requireAgencySession } from "@shared/lib/tenant-session";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const widgetLanguages: TenantWidgetLanguage[] = ["en", "ru", "th", "zh"];
const widgetPersonaGenders = ["feminine", "masculine", "neutral"] as const;
const widgetTones: TenantWidgetTone[] = ["friendly", "professional", "luxury", "concise"];

export async function updateTenantSettingsAction(formData: FormData) {
  const { tenantId } = await requireAgencySession();
  const displayName = getOptionalString(formData, "displayName");
  const primaryColor = getOptionalString(formData, "primaryColor");
  const logoUrl = getOptionalString(formData, "logoUrl");
  const customDomain = getOptionalString(formData, "customDomain");
  const allowedOrigins = getAllowedOrigins(formData);
  const leadNotificationEmails = getEmailList(formData, "leadNotificationEmails");
  const leadNotificationsEnabled = formData.get("leadNotificationsEnabled") === "on";
  const leadWebhookUrl = getOptionalString(formData, "leadWebhookUrl");
  const leadTelegramChatIds = getTextList(formData, "leadTelegramChatIds");
  const leadTelegramBotToken = getOptionalString(formData, "leadTelegramBotToken");
  const leadTelegramWebhookSecret = getOptionalString(formData, "leadTelegramWebhookSecret");
  const leadLineRecipientIds = getTextList(formData, "leadLineRecipientIds");
  const leadLineChannelAccessToken = getOptionalString(formData, "leadLineChannelAccessToken");
  const leadLineChannelSecret = getOptionalString(formData, "leadLineChannelSecret");
  const leadWhatsappRecipients = getPhoneList(formData, "leadWhatsappRecipients");
  const leadWhatsappAccessToken = getOptionalString(formData, "leadWhatsappAccessToken");
  const leadWhatsappAppSecret = getOptionalString(formData, "leadWhatsappAppSecret");
  const leadWhatsappPhoneNumberId = getOptionalString(formData, "leadWhatsappPhoneNumberId");
  const leadWhatsappGraphApiVersion = getOptionalString(formData, "leadWhatsappGraphApiVersion");
  const leadWhatsappWebhookVerifyToken = getOptionalString(formData, "leadWhatsappWebhookVerifyToken");
  const listingUrlTemplate = getListingUrlTemplate(formData);
  const primaryMarket = getOptionalMarket(formData);
  const languages = getLanguageCodes(formData);
  const leadQualificationFields = getLeadQualificationFields(formData);
  const aiNames = getLocalizedStrings(formData, "aiName");
  const aiName = aiNames.en;
  const personaGenders = getPersonaGenders(formData);
  const tone = getWidgetTone(formData);
  const welcomeMessages = getWelcomeMessages(formData);
  const welcomeMessage = welcomeMessages.en;

  await updateTenantSettings(
    {
      ...(primaryMarket ? { primaryMarket } : {}),
      ...(customDomain ? { customDomain } : {}),
      branding: {
        ...(displayName ? { displayName } : {}),
        ...(primaryColor ? { primaryColor } : {}),
        ...(logoUrl ? { logoUrl } : {})
      },
      widget: {
        ...(aiName ? { aiName } : {}),
        ...(Object.keys(aiNames).length ? { aiNames } : {}),
        ...(allowedOrigins ? { allowedOrigins } : {}),
        ...(leadNotificationEmails ? { leadNotificationEmails } : {}),
        leadNotificationsEnabled,
        leadWebhookUrl: leadWebhookUrl ?? "",
        ...(leadTelegramChatIds ? { leadTelegramChatIds } : {}),
        ...(leadTelegramBotToken ? { leadTelegramBotToken } : {}),
        ...(leadTelegramWebhookSecret ? { leadTelegramWebhookSecret } : {}),
        ...(leadLineRecipientIds ? { leadLineRecipientIds } : {}),
        ...(leadLineChannelAccessToken ? { leadLineChannelAccessToken } : {}),
        ...(leadLineChannelSecret ? { leadLineChannelSecret } : {}),
        ...(leadWhatsappRecipients ? { leadWhatsappRecipients } : {}),
        ...(leadWhatsappAccessToken ? { leadWhatsappAccessToken } : {}),
        ...(leadWhatsappAppSecret ? { leadWhatsappAppSecret } : {}),
        ...(leadWhatsappPhoneNumberId ? { leadWhatsappPhoneNumberId } : {}),
        ...(leadWhatsappGraphApiVersion ? { leadWhatsappGraphApiVersion } : {}),
        ...(leadWhatsappWebhookVerifyToken ? { leadWhatsappWebhookVerifyToken } : {}),
        ...(languages.length ? { languages } : {}),
        ...(leadQualificationFields ? { leadQualificationFields } : {}),
        ...(listingUrlTemplate ? { listingUrlTemplate } : {}),
        ...(Object.keys(personaGenders).length ? { personaGenders } : {}),
        ...(tone ? { tone } : {}),
        ...(welcomeMessage ? { welcomeMessage } : {}),
        ...(Object.keys(welcomeMessages).length ? { welcomeMessages } : {})
      }
    },
    { tenantId }
  );

  revalidatePath("/settings");
  redirect("/settings?updated=tenant-settings#tenant-settings-form");
}

export async function verifyNotificationProviderAction(provider: TenantNotificationProvider, formData: FormData) {
  await requireAgencySession();
  const result = await verifyNotificationProvider(getNotificationProviderPayload(provider, formData));

  redirect(buildNotificationResultUrl("verify", result));
}

export async function beginNotificationProviderConnectionAction(provider: TenantNotificationProvider, _formData: FormData) {
  await requireAgencySession();
  const result = await beginNotificationProviderConnection({
    provider
  });

  redirect(buildNotificationConnectUrl(result));
}

export async function sendNotificationProviderTestAction(provider: TenantNotificationProvider, formData: FormData) {
  await requireAgencySession();
  const result = await sendNotificationProviderTest(getNotificationProviderPayload(provider, formData));

  redirect(buildNotificationResultUrl("test", result));
}

function getTextList(formData: FormData, key: string): string[] | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  const raw = String(formData.get(key) ?? "");

  return Array.from(new Set(raw.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean))).slice(0, 10);
}

function getNotificationProviderPayload(provider: TenantNotificationProvider, formData: FormData) {
  return {
    lineChannelAccessToken: getOptionalString(formData, "leadLineChannelAccessToken"),
    lineRecipientIds: getTextList(formData, "leadLineRecipientIds"),
    provider,
    telegramBotToken: getOptionalString(formData, "leadTelegramBotToken"),
    telegramChatIds: getTextList(formData, "leadTelegramChatIds"),
    whatsappAccessToken: getOptionalString(formData, "leadWhatsappAccessToken"),
    whatsappGraphApiVersion: getOptionalString(formData, "leadWhatsappGraphApiVersion"),
    whatsappPhoneNumberId: getOptionalString(formData, "leadWhatsappPhoneNumberId"),
    whatsappRecipients: getPhoneList(formData, "leadWhatsappRecipients")
  };
}

function buildNotificationResultUrl(
  action: "test" | "verify",
  result: TenantNotificationProviderCheckResponse
): string {
  const params = new URLSearchParams({
    notificationAction: action,
    notificationProvider: result.provider,
    notificationStatus: result.status
  });

  if (result.displayName) {
    params.set("notificationName", result.displayName);
  }

  if (result.error) {
    params.set("notificationError", result.error);
  }

  return `/settings?${params.toString()}#lead-notification-settings`;
}

function buildNotificationConnectUrl(result: TenantNotificationProviderConnectResponse): string {
  const params = new URLSearchParams({
    notificationAction: "connect",
    notificationCode: result.code,
    notificationExpiresAt: result.expiresAt,
    notificationProvider: result.provider,
    notificationStatus: "connected",
    notificationWebhookUrl: result.webhookUrl
  });

  return `/settings?${params.toString()}#lead-notification-settings`;
}

function getPhoneList(formData: FormData, key: string): string[] | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  return getTextList(formData, key)
    ?.map((value) => value.replace(/[^\d+]/g, ""))
    .filter((value) => /^\+?[1-9]\d{7,14}$/.test(value));
}

function getEmailList(formData: FormData, key: string): string[] | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  const raw = String(formData.get(key) ?? "");

  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    )
  ).slice(0, 5);
}

function getListingUrlTemplate(formData: FormData): string | undefined {
  return normalizeWidgetListingUrlTemplate(getOptionalString(formData, "listingUrlTemplate"));
}

function getAllowedOrigins(formData: FormData): string[] | undefined {
  if (!formData.has("allowedOrigins")) {
    return undefined;
  }

  const raw = String(formData.get("allowedOrigins") ?? "");

  if (!raw) {
    return [];
  }

  const origins = raw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  return origins;
}

function getWidgetTone(formData: FormData): TenantWidgetTone | undefined {
  const value = String(formData.get("tone") ?? "").trim();

  return widgetTones.includes(value as TenantWidgetTone) ? (value as TenantWidgetTone) : undefined;
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || undefined;
}

function getOptionalMarket(formData: FormData): ThailandMarket | undefined {
  const value = String(formData.get("primaryMarket") ?? "").trim();

  return markets.includes(value as ThailandMarket) ? (value as ThailandMarket) : undefined;
}

function getLanguageCodes(formData: FormData): TenantWidgetLanguage[] {
  const selected = formData.getAll("languages").map((language) => String(language).trim().toLowerCase());

  return widgetLanguages.filter((language) => selected.includes(language));
}

function getLeadQualificationFields(formData: FormData): TenantLeadQualificationField[] | undefined {
  if (!formData.has("leadQualificationFieldsIntent")) {
    return undefined;
  }

  const selected = formData.getAll("leadQualificationFields").map((field) => String(field).trim());

  return supportedLeadQualificationFields.filter((field) => selected.includes(field));
}

function getWelcomeMessages(formData: FormData): Partial<Record<TenantWidgetLanguage, string>> {
  return getLocalizedStrings(formData, "welcomeMessage");
}

function getLocalizedStrings(formData: FormData, fieldName: string): Partial<Record<TenantWidgetLanguage, string>> {
  return widgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, string>>>((messages, language) => {
    const value = getOptionalString(formData, `${fieldName}.${language}`);

    if (value) {
      messages[language] = value;
    }

    return messages;
  }, {});
}

function getPersonaGenders(formData: FormData) {
  return widgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, (typeof widgetPersonaGenders)[number]>>>(
    (genders, language) => {
      const value = String(formData.get(`personaGender.${language}`) ?? "").trim();

      if (widgetPersonaGenders.includes(value as (typeof widgetPersonaGenders)[number])) {
        genders[language] = value as (typeof widgetPersonaGenders)[number];
      }

      return genders;
    },
    {}
  );
}
