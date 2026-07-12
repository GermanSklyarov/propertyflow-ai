"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runListingAssistant } from "@shared/api/agency-client";

export async function runListingAssistantAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!propertyId) {
    return;
  }

  const result = await runListingAssistant(propertyId, {
    generateDescriptions: true,
    locales: ["en", "ru"],
    requestedActions: ["property.ai_description.generate", "property.ai_description.apply", "property.image.delete"]
  });

  revalidatePath("/ai-tools");
  revalidatePath(`/listings/${propertyId}`);

  const params = new URLSearchParams({
    assistant: "queued",
    jobs: String(result.jobs.length),
    policy: String(result.actionPolicy.length),
    property: title || propertyId
  });

  redirect(`/ai-tools?${params.toString()}#assistant-result`);
}
