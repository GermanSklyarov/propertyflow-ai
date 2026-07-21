"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TenantWidgetLanguage, TenantWidgetTone } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";
import { updateTenantSettings } from "@shared/api/agency-client";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const widgetLanguages: TenantWidgetLanguage[] = ["en", "ru", "th", "zh"];
const widgetPersonaGenders = ["feminine", "masculine", "neutral"] as const;
const widgetTones: TenantWidgetTone[] = ["friendly", "professional", "luxury", "concise"];

export async function updateTenantSettingsAction(formData: FormData) {
  const displayName = getOptionalString(formData, "displayName");
  const primaryColor = getOptionalString(formData, "primaryColor");
  const logoUrl = getOptionalString(formData, "logoUrl");
  const customDomain = getOptionalString(formData, "customDomain");
  const primaryMarket = getOptionalMarket(formData);
  const languages = getLanguageCodes(formData);
  const aiNames = getLocalizedStrings(formData, "aiName");
  const aiName = aiNames.en;
  const personaGenders = getPersonaGenders(formData);
  const tone = getWidgetTone(formData);
  const welcomeMessages = getWelcomeMessages(formData);
  const welcomeMessage = welcomeMessages.en;

  await updateTenantSettings({
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
      ...(languages.length ? { languages } : {}),
      ...(Object.keys(personaGenders).length ? { personaGenders } : {}),
      ...(tone ? { tone } : {}),
      ...(welcomeMessage ? { welcomeMessage } : {}),
      ...(Object.keys(welcomeMessages).length ? { welcomeMessages } : {})
    }
  });

  revalidatePath("/settings");
  redirect("/settings?updated=tenant-settings#tenant-settings-form");
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
