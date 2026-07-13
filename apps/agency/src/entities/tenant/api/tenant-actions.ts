"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ThailandMarket } from "@propertyflow/domain";
import { updateTenantSettings } from "@shared/api/agency-client";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export async function updateTenantSettingsAction(formData: FormData) {
  const displayName = getOptionalString(formData, "displayName");
  const primaryColor = getOptionalString(formData, "primaryColor");
  const logoUrl = getOptionalString(formData, "logoUrl");
  const customDomain = getOptionalString(formData, "customDomain");
  const primaryMarket = getOptionalMarket(formData);

  await updateTenantSettings({
    ...(primaryMarket ? { primaryMarket } : {}),
    ...(customDomain ? { customDomain } : {}),
    branding: {
      ...(displayName ? { displayName } : {}),
      ...(primaryColor ? { primaryColor } : {}),
      ...(logoUrl ? { logoUrl } : {})
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
