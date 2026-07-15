"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPropertyProject } from "@shared/api/agency-client";
import type { CreatePropertyProjectRequest } from "@propertyflow/contracts";
import type { PropertyProjectStatus, ThailandMarket } from "@propertyflow/domain";

export async function createPropertyProjectAction(formData: FormData) {
  const name = getRequiredString(formData, "name");
  const market = getRequiredString(formData, "market") as ThailandMarket;
  const status = getOptionalString(formData, "status") as PropertyProjectStatus | undefined;
  const amenities = getAmenities(formData);

  await createPropertyProject({
    name,
    market,
    status,
    developer: getOptionalString(formData, "developer"),
    address: getOptionalString(formData, "address"),
    completionYear: getOptionalNumber(formData, "completionYear"),
    ...(amenities.length ? { amenities } : {})
  } satisfies CreatePropertyProjectRequest);

  revalidatePath("/projects");
  revalidatePath("/listings");

  redirect("/projects?created=project#project-directory");
}

function getRequiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || undefined;
}

function getOptionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();

  if (!raw) {
    return undefined;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : undefined;
}

function getAmenities(formData: FormData) {
  return String(formData.get("amenities") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
