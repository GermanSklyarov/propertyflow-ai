"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runListingAssistant } from "@shared/api/agency-client";

export async function runListingAssistantAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const imageUrls = formData.getAll("imageUrls").map((value) => String(value)).filter(Boolean);
  const imageIds = formData.getAll("imageIds").map((value) => String(value)).filter(Boolean);

  if (!propertyId) {
    return;
  }

  const result = await runListingAssistant(propertyId, {
    analyzeImages: imageUrls.length > 0,
    generateDescriptions: true,
    imageIds: imageIds.length === imageUrls.length ? imageIds : undefined,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    locales: ["en", "ru"],
    requestedActions: [
      "property.ai_description.generate",
      "property.images.analyze",
      "property.ai_description.apply",
      "property.ai_image_analysis.apply",
      "property.image.delete"
    ]
  });

  revalidatePath("/ai-tools");
  revalidatePath(`/listings/${propertyId}`);

  const params = new URLSearchParams({
    assistant: "queued",
    jobs: String(result.jobs.length),
    policy: String(result.actionPolicy.length),
    property: title || propertyId,
    propertyId
  });

  redirect(`/ai-tools?${params.toString()}#assistant-result`);
}
