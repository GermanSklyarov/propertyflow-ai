"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addPropertyImage,
  applyPropertyImageAnalysisAsset,
  confirmPropertyImageUpload,
  createPropertyImageUploadUrl,
  reviewPropertyImageAnalysisAsset
} from "@shared/api/agency-client";

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
  revalidatePath(`/properties/${propertyId}`);

  if (analyzeImage) {
    redirect(`/listings/${propertyId}?queued=image-analysis#ai-image-analysis`);
  }
}

export async function uploadPropertyImageAction(propertyId: string, formData: FormData) {
  const file = formData.get("imageFile");
  const caption = String(formData.get("caption") ?? "").trim();
  const analyzeImage = formData.get("analyzeImage") === "on";

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Image file is required");
  }

  const upload = await createPropertyImageUploadUrl(propertyId, {
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size
  });

  const uploadResponse = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload property image file: ${uploadResponse.status}`);
  }

  await confirmPropertyImageUpload(propertyId, {
    analyzeImage,
    bucket: upload.bucket,
    caption: caption || undefined,
    mimeType: file.type || undefined,
    objectKey: upload.objectKey,
    originalFilename: file.name,
    sizeBytes: file.size
  });

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  if (analyzeImage) {
    redirect(`/listings/${propertyId}?queued=image-analysis#ai-image-analysis`);
  }
}

export async function reviewPropertyImageAnalysisAction(
  propertyId: string,
  assetId: string,
  status: "approved" | "rejected"
) {
  await reviewPropertyImageAnalysisAsset(propertyId, assetId, { status });

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
}

export async function applyPropertyImageAnalysisAction(propertyId: string, assetId: string) {
  await applyPropertyImageAnalysisAsset(propertyId, assetId);

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
}
