"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addPropertyImage,
  applyPropertyDescriptionAsset,
  applyPropertyImageAnalysisAsset,
  confirmPropertyImageUpload,
  createProperty,
  createPropertyImportUploadUrl,
  createPropertyImageUploadUrl,
  deletePropertyImage,
  enqueuePropertyImport,
  previewPropertyImageDelete,
  restorePropertyImage,
  reviewPropertyDescriptionAsset,
  reviewPropertyImageAnalysisAsset,
  updatePropertyDescriptionAsset,
  updatePropertyAmenities,
  updatePropertyImageAnalysisAsset,
  updatePropertyProject
} from "@shared/api/agency-client";
import type { CreatePropertyRequest } from "@propertyflow/contracts";
import type { PropertyProjectStatus, ThailandMarket } from "@propertyflow/domain";

const marketCoordinates = {
  pattaya: { latitude: 12.9236, longitude: 100.8825 },
  phuket: { latitude: 7.8804, longitude: 98.3923 },
  bangkok: { latitude: 13.7563, longitude: 100.5018 },
  "hua-hin": { latitude: 12.5684, longitude: 99.9577 },
  "koh-samui": { latitude: 9.512, longitude: 100.0136 }
} satisfies Record<ThailandMarket, { latitude: number; longitude: number }>;

export async function createPropertyAction(formData: FormData) {
  const market = getMarket(formData);
  const listingType = getRequiredString(formData, "listingType") as CreatePropertyRequest["listingType"];
  const priceThb = getOptionalNumber(formData, "priceThb") ?? 0;
  const rentalPriceMonthlyThb = getOptionalNumber(formData, "rentalPriceMonthlyThb");
  const monthlyRentEstimateThb = getOptionalNumber(formData, "monthlyRentEstimateThb") ?? rentalPriceMonthlyThb;
  const maintenanceFeeMonthlyThb = getOptionalNumber(formData, "maintenanceFeeMonthlyThb");
  const amenities = getAmenities(formData);
  const projectName = getOptionalString(formData, "projectName");
  const projectStatus = getOptionalString(formData, "projectStatus") as PropertyProjectStatus | undefined;
  const images = getImageFiles(formData);
  const analyzeImages = formData.get("analyzeImages") === "on";
  const chanoteExtraction = await extractChanoteData(formData);
  const description = buildDescriptionWithChanote(getOptionalString(formData, "description"), chanoteExtraction);

  const property = await createProperty({
    title: getRequiredString(formData, "title"),
    description,
    kind: getRequiredString(formData, "kind") as CreatePropertyRequest["kind"],
    listingType,
    market,
    price: { amount: priceThb, currency: "THB" },
    ...(rentalPriceMonthlyThb !== undefined ? { rentalPriceMonthly: { amount: rentalPriceMonthlyThb, currency: "THB" } } : {}),
    location: marketCoordinates[market],
    address: chanoteExtraction.address ?? getOptionalString(formData, "address"),
    bedrooms: getOptionalInteger(formData, "bedrooms") ?? 0,
    bathrooms: getOptionalInteger(formData, "bathrooms") ?? 0,
    areaSqm: getOptionalNumber(formData, "areaSqm") ?? chanoteExtraction.areaSqm ?? 1,
    floor: getOptionalInteger(formData, "floor"),
    beachDistanceMeters: getOptionalInteger(formData, "beachDistanceMeters"),
    ...(monthlyRentEstimateThb !== undefined ? { monthlyRentEstimate: { amount: monthlyRentEstimateThb, currency: "THB" } } : {}),
    ...(maintenanceFeeMonthlyThb !== undefined ? { maintenanceFeeMonthly: { amount: maintenanceFeeMonthlyThb, currency: "THB" } } : {}),
    ...(amenities.length ? { amenities } : {}),
    ...(projectName
      ? {
          project: {
            name: projectName,
            status: projectStatus,
            developer: getOptionalString(formData, "projectDeveloper")
          }
        }
      : {})
  });

  await Promise.all(images.map((file) => uploadCreatedPropertyImage(property.id, file, analyzeImages)));

  revalidatePath("/listings");
  revalidatePath(`/listings/${property.id}`);
  revalidatePath(`/properties/${property.id}`);

  const params = new URLSearchParams({ created: "1" });

  if (images.length && analyzeImages) {
    params.set("queued", "image-analysis");
  }

  redirect(`/listings/${property.id}?${params.toString()}${images.length && analyzeImages ? "#ai-image-analysis" : ""}`);
}

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

export async function deletePropertyImageAction(propertyId: string, imageId: string) {
  const preview = await previewPropertyImageDelete(propertyId, imageId);

  await deletePropertyImage(propertyId, imageId, {
    confirmationToken: preview.confirmationToken
  });

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
}

export async function restorePropertyImageAction(propertyId: string, imageId: string) {
  await restorePropertyImage(propertyId, imageId);

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
}

export async function updatePropertyProjectAction(propertyId: string, formData: FormData) {
  const projectName = getOptionalString(formData, "projectName");

  await updatePropertyProject(propertyId, {
    note: getOptionalString(formData, "note"),
    project: projectName
      ? {
          name: projectName,
          status: getOptionalString(formData, "projectStatus") as PropertyProjectStatus | undefined,
          developer: getOptionalString(formData, "projectDeveloper")
        }
      : null
  });

  revalidatePath("/projects");
  revalidatePath("/listings");
  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  redirect(`/listings/${propertyId}?project=updated#development-project`);
}

export async function updatePropertyAmenitiesAction(propertyId: string, formData: FormData) {
  await updatePropertyAmenities(propertyId, {
    amenities: getAmenities(formData),
    note: getOptionalString(formData, "note")
  });

  revalidatePath("/listings");
  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  redirect(`/listings/${propertyId}?amenities=updated#amenities`);
}

export async function importPropertiesCsvAction(formData: FormData) {
  const csvFile = formData.get("listingsCsv");
  const pastedCsv = getOptionalString(formData, "csvText");
  const hasCsvFile = csvFile instanceof File && csvFile.size > 0;

  if (!hasCsvFile && !pastedCsv) {
    redirect("/listings?importError=empty#import-listings");
  }

  const objectUrl = hasCsvFile ? await uploadImportCsv(csvFile) : `data:text/csv;charset=utf-8,${encodeURIComponent(pastedCsv!)}`;
  const job = await enqueuePropertyImport({
    columnMapping: getColumnMapping(formData),
    dryRun: formData.get("dryRun") === "on",
    objectUrl,
    source: "csv"
  });

  revalidatePath("/listings");

  const params = new URLSearchParams({ importJob: job.id });

  redirect(`/listings?${params.toString()}#import-listings`);
}

function getColumnMapping(formData: FormData) {
  const value = getOptionalString(formData, "columnMapping");

  if (!value) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;

  if (!isStringRecord(parsed)) {
    return undefined;
  }

  return parsed;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string" && item.length > 0)
  );
}

async function uploadImportCsv(file: File) {
  const upload = await createPropertyImportUploadUrl({
    filename: file.name,
    mimeType: file.type || "text/csv",
    sizeBytes: file.size
  });

  const uploadResponse = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload property import file: ${uploadResponse.status}`);
  }

  return upload.objectUrl;
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

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }

  return value;
}

function getOptionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getOptionalInteger(formData: FormData, key: string) {
  const value = getOptionalNumber(formData, key);

  return value === undefined ? undefined : Math.trunc(value);
}

function getMarket(formData: FormData): ThailandMarket {
  const value = getRequiredString(formData, "market") as ThailandMarket;

  return value in marketCoordinates ? value : "pattaya";
}

function getAmenities(formData: FormData) {
  return String(formData.get("amenities") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getImageFiles(formData: FormData) {
  return formData
    .getAll("imageFiles")
    .filter((file): file is File => file instanceof File && file.size > 0);
}

interface ChanoteExtraction {
  address?: string;
  areaSqm?: number;
  ownerName?: string;
  sourceFilename?: string;
}

async function extractChanoteData(formData: FormData): Promise<ChanoteExtraction> {
  const pastedText = getOptionalString(formData, "chanoteText");
  const file = formData.get("chanoteFile");
  const sourceFilename = file instanceof File && file.size > 0 ? file.name : undefined;
  const fileText = file instanceof File && file.size > 0 && isTextLikeFile(file) ? await file.text() : undefined;
  const text = [pastedText, fileText, sourceFilename].filter(Boolean).join("\n");

  if (!text) {
    return {};
  }

  return {
    address: extractLabeledValue(text, ["address", "location", "ที่ตั้ง", "адрес"]),
    areaSqm: extractAreaSqm(text),
    ownerName: extractLabeledValue(text, ["owner", "owner name", "proprietor", "ผู้ถือกรรมสิทธิ์", "собственник", "владелец"]),
    sourceFilename
  };
}

function isTextLikeFile(file: File) {
  return file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt");
}

function extractLabeledValue(text: string, labels: string[]) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inlineMatch = text.match(new RegExp(`${escaped}\\s*[:：-]\\s*([^\\n]+)`, "i"));

    if (inlineMatch?.[1]) {
      return inlineMatch[1].trim();
    }

    const labelIndex = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());

    if (labelIndex >= 0 && lines[labelIndex + 1]) {
      return lines[labelIndex + 1];
    }
  }

  return undefined;
}

function extractAreaSqm(text: string) {
  const sqmMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:sqm|sq\.?\s*m|m2|m²|ตร\.?\s*ม\.?|square meters?)/i);

  if (sqmMatch?.[1]) {
    return Number(sqmMatch[1].replace(",", "."));
  }

  const raiMatch = text.match(/(\d+(?:[.,]\d+)?)\s*rai/i);

  if (raiMatch?.[1]) {
    return Number(raiMatch[1].replace(",", ".")) * 1600;
  }

  return undefined;
}

function buildDescriptionWithChanote(description: string | undefined, extraction: ChanoteExtraction) {
  const notes = [
    extraction.ownerName ? `Chanote owner: ${extraction.ownerName}.` : undefined,
    extraction.address ? `Chanote address: ${extraction.address}.` : undefined,
    extraction.areaSqm ? `Chanote area: ${extraction.areaSqm} sqm.` : undefined,
    extraction.sourceFilename ? `Chanote source uploaded: ${extraction.sourceFilename}.` : undefined
  ].filter(Boolean);

  if (!notes.length) {
    return description;
  }

  return [description, `Chanote OCR draft: ${notes.join(" ")}`].filter(Boolean).join("\n\n");
}

async function uploadCreatedPropertyImage(propertyId: string, file: File, analyzeImage: boolean) {
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
    mimeType: file.type || undefined,
    objectKey: upload.objectKey,
    originalFilename: file.name,
    sizeBytes: file.size
  });
}

export async function uploadPropertyImageAction(propertyId: string, formData: FormData) {
  const file = formData.get("imageFile");
  const caption = String(formData.get("caption") ?? "").trim();
  const analyzeImage = formData.get("analyzeImage") === "on";

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Image file is required");
  }

  await uploadExistingPropertyImage(propertyId, file, analyzeImage, caption);

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  if (analyzeImage) {
    redirect(`/listings/${propertyId}?queued=image-analysis#ai-image-analysis`);
  }
}

async function uploadExistingPropertyImage(propertyId: string, file: File, analyzeImage: boolean, caption?: string) {
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

export async function updatePropertyImageAnalysisAction(propertyId: string, assetId: string, formData: FormData) {
  await updatePropertyImageAnalysisAsset(propertyId, assetId, {
    detectedFeatures: getAmenities(formData),
    note: getOptionalString(formData, "note")
  });

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  redirect(`/listings/${propertyId}?asset=edited&type=image-analysis#ai-image-analysis`);
}

export async function applyPropertyImageAnalysisAction(propertyId: string, assetId: string) {
  await applyPropertyImageAnalysisAsset(propertyId, assetId);

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  redirect(`/listings/${propertyId}?applied=image-features&asset=${assetId}#amenities`);
}

export async function reviewPropertyDescriptionAction(
  propertyId: string,
  assetId: string,
  status: "approved" | "rejected"
) {
  await reviewPropertyDescriptionAsset(propertyId, assetId, { status });

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
}

export async function updatePropertyDescriptionAction(propertyId: string, assetId: string, formData: FormData) {
  await updatePropertyDescriptionAsset(propertyId, assetId, {
    description: getRequiredString(formData, "description"),
    note: getOptionalString(formData, "note"),
    title: getRequiredString(formData, "title")
  });

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  redirect(`/listings/${propertyId}?asset=edited&type=description#ai-descriptions`);
}

export async function applyPropertyDescriptionAction(propertyId: string, assetId: string) {
  await applyPropertyDescriptionAsset(propertyId, assetId);

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);

  redirect(`/listings/${propertyId}?applied=description&asset=${assetId}#listing-brief`);
}
