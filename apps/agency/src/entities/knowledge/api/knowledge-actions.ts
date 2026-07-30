"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreateKnowledgeDocumentRequest, CreateListingSourceRequest, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import {
  createKnowledgeDocument,
  createKnowledgeDocumentUploadUrl,
  createRestListingSource,
  embedKnowledgeChunks,
  ingestKnowledgeDocument,
  syncListingSource
} from "@shared/api/agency-client";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { resolveKnowledgeDocumentBody } from "../model/knowledge-document-draft";
import { buildKnowledgeSourceTags, resolveKnowledgeSourceKind } from "../model/knowledge-source-presets";

export async function createKnowledgeDocumentAction(formData: FormData) {
  const { tenantId } = await requireAgencySession();
  const title = String(formData.get("title") ?? "").trim();
  const typedBody = String(formData.get("body") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const sourceFile = getSourceFile(formData.get("sourceFile"));
  const sourceUpload = sourceFile ? await uploadKnowledgeSourceFile(sourceFile, { tenantId }) : undefined;
  const body = await resolveKnowledgeDocumentBody(typedBody, sourceFile, { sourceUpload, sourceUrl });
  const locale = String(formData.get("locale") ?? "en") as CreateKnowledgeDocumentRequest["locale"];
  const fallbackKind = String(formData.get("kind") ?? "article") as CreateKnowledgeDocumentRequest["kind"];
  const sourcePresetId = String(formData.get("sourcePreset") ?? "custom");
  const kind = resolveKnowledgeSourceKind(sourcePresetId, fallbackKind);
  const tags = buildKnowledgeSourceTags({
    sourceFileName: sourceFile?.name,
    sourcePresetId,
    sourceUrl,
    storageBacked: Boolean(sourceUpload),
    typedTags: String(formData.get("tags") ?? "")
  });

  if (!title || !body) {
    return;
  }

  const document = await createKnowledgeDocument({
    body,
    kind,
    locale,
    tags,
    title
  }, { tenantId });
  await ingestKnowledgeDocument(document.id, { tenantId });

  revalidatePath("/knowledge");

  const params = new URLSearchParams({
    created: document.title,
    document: document.title,
    ingest: "queued"
  });

  redirect(`/knowledge?${params.toString()}#knowledge-jobs`);
}

function getSourceFile(value: FormDataEntryValue | null): File | null {
  return typeof File !== "undefined" && value instanceof File && value.size > 0 ? value : null;
}

async function uploadKnowledgeSourceFile(file: File, options: { tenantId?: string } = {}) {
  const upload = await createKnowledgeDocumentUploadUrl({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size
  }, options);

  const uploadResponse = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload knowledge source file: ${uploadResponse.status}`);
  }

  return {
    objectKey: upload.objectKey,
    objectUrl: upload.objectUrl
  };
}

export async function ingestKnowledgeDocumentAction(documentId: KnowledgeDocumentSnapshot["id"], title: string) {
  const { tenantId } = await requireAgencySession();

  await ingestKnowledgeDocument(documentId, { tenantId });

  revalidatePath("/knowledge");

  redirect(`/knowledge?ingest=queued&document=${encodeURIComponent(title)}#knowledge-jobs`);
}

export async function syncListingSourceAction(sourceId: string, name: string) {
  const { tenantId } = await requireAgencySession();

  await syncListingSource(sourceId, { tenantId });

  revalidatePath("/knowledge");

  const params = new URLSearchParams({
    listingSync: "queued",
    source: name
  });

  redirect(`/knowledge?${params.toString()}#listing-api-sources`);
}

export async function createRestListingSourceAction(formData: FormData) {
  const { tenantId } = await requireAgencySession();
  const name = String(formData.get("name") ?? "").trim();
  const endpointUrl = String(formData.get("endpointUrl") ?? "").trim();
  const rootPath = String(formData.get("rootPath") ?? "").trim();
  const authType = String(formData.get("authType") ?? "api-key-header") as CreateListingSourceRequest["authType"];
  const authHeaderName = String(formData.get("authHeaderName") ?? "").trim();
  const authSecretRef = String(formData.get("authSecretRef") ?? "").trim();
  const importMode = String(formData.get("importMode") ?? "concierge_index_only") as CreateListingSourceRequest["importMode"];
  const canonical = parseMappingJson(formData.get("canonicalMapping"));
  const customAttributes = parseCustomAttributeJson(formData.get("customAttributes"));

  if (!name || !endpointUrl) {
    return;
  }

  const source = await createRestListingSource(
    {
      authHeaderName: authHeaderName || undefined,
      authSecretRef: authSecretRef || undefined,
      authType,
      endpointUrl,
      importMode,
      mapping: {
        canonical,
        customAttributes,
        rawPayloadMode: "store_selected",
        rootPath: rootPath || undefined
      },
      name,
      type: "rest-api"
    },
    { tenantId }
  );

  await syncListingSource(source.id, { tenantId });

  revalidatePath("/knowledge");

  const params = new URLSearchParams({
    listingSync: "queued",
    source: source.name
  });

  redirect(`/knowledge?${params.toString()}#listing-api-sources`);
}

export async function embedKnowledgeChunksAction(formData: FormData) {
  const { tenantId } = await requireAgencySession();
  const query = String(formData.get("q") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const returnTo = resolveEmbeddingReturnPath(String(formData.get("returnTo") ?? "").trim());

  await embedKnowledgeChunks({
    limit: 100,
    refreshExisting: true
  }, { tenantId });

  revalidatePath("/knowledge");
  if (returnTo) {
    revalidatePath(returnTo.pathname);
  }

  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (locale) {
    params.set("locale", locale);
  }
  if (kind) {
    params.set("kind", kind);
  }
  params.set("embed", "queued");

  if (returnTo) {
    returnTo.searchParams.set("embed", "queued");
    redirect(`${returnTo.pathname}?${returnTo.searchParams.toString()}${returnTo.hash}`);
  }

  redirect(`/knowledge?${params.toString()}#retrieval-preview`);
}

function parseMappingJson(value: FormDataEntryValue | null): CreateListingSourceRequest["mapping"]["canonical"] {
  const parsed = parseJsonRecord(value);

  return Object.fromEntries(
    Object.entries(parsed).filter(([, sourcePath]) => typeof sourcePath === "string" && sourcePath.trim().length > 0)
  ) as CreateListingSourceRequest["mapping"]["canonical"];
}

function parseCustomAttributeJson(value: FormDataEntryValue | null): NonNullable<CreateListingSourceRequest["mapping"]["customAttributes"]> {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;

  return Array.isArray(parsed)
    ? (parsed as NonNullable<CreateListingSourceRequest["mapping"]["customAttributes"]>)
    : [];
}

function parseJsonRecord(value: FormDataEntryValue | null): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;

  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function resolveEmbeddingReturnPath(value: string): URL | null {
  if (!value.startsWith("/")) {
    return null;
  }

  const url = new URL(value, "https://propertyflow.local");
  const allowedPaths = new Set(["/knowledge", "/setup"]);

  return allowedPaths.has(url.pathname) ? url : null;
}
