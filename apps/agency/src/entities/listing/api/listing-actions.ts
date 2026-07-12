"use server";

import { revalidatePath } from "next/cache";
import { addPropertyImage } from "@shared/api/agency-client";

export async function addPropertyImageAction(propertyId: string, formData: FormData) {
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const analyzeImage = formData.get("analyzeImage") === "on";

  if (!imageUrl) {
    return;
  }

  await addPropertyImage(propertyId, {
    analyzeImage,
    caption: caption || undefined,
    imageUrl
  });

  revalidatePath(`/listings/${propertyId}`);
}
