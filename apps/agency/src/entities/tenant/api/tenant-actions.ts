"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TenantWidgetLanguage } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";
import { updateTenantSettings } from "@shared/api/agency-client";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const widgetLanguages: TenantWidgetLanguage[] = ["en", "ru", "th", "zh"];

export async function updateTenantSettingsAction(formData: FormData) {
  const displayName = getOptionalString(formData, "displayName");
  const primaryColor = getOptionalString(formData, "primaryColor");
  const logoUrl = getOptionalString(formData, "logoUrl");
  const customDomain = getOptionalString(formData, "customDomain");
  const primaryMarket = getOptionalMarket(formData);
  const aiName = getOptionalString(formData, "aiName");
  const languages = getLanguageCodes(formData);
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
      ...(languages.length ? { languages } : {}),
      ...(welcomeMessage ? { welcomeMessage } : {}),
      ...(Object.keys(welcomeMessages).length ? { welcomeMessages } : {})
    }
  });

  revalidatePath("/settings");
  redirect("/settings?updated=tenant-settings#tenant-settings-form");
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
  return widgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, string>>>((messages, language) => {
    const value = getOptionalString(formData, `welcomeMessage.${language}`);

    if (value) {
      messages[language] = value;
    }

    return messages;
  }, {});
}
