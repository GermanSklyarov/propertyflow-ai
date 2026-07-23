"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreateKnowledgeDocumentRequest, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import {
  createKnowledgeDocument,
  createKnowledgeDocumentUploadUrl,
  embedKnowledgeChunks,
  ingestKnowledgeDocument
} from "@shared/api/agency-client";
import { resolveKnowledgeDocumentBody } from "../model/knowledge-document-draft";
import { buildKnowledgeSourceTags, resolveKnowledgeSourceKind } from "../model/knowledge-source-presets";

export async function createKnowledgeDocumentAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const typedBody = String(formData.get("body") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const sourceFile = getSourceFile(formData.get("sourceFile"));
  const sourceUpload = sourceFile ? await uploadKnowledgeSourceFile(sourceFile) : undefined;
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
  });
  await ingestKnowledgeDocument(document.id);

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

async function uploadKnowledgeSourceFile(file: File) {
  const upload = await createKnowledgeDocumentUploadUrl({
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
    throw new Error(`Failed to upload knowledge source file: ${uploadResponse.status}`);
  }

  return {
    objectKey: upload.objectKey,
    objectUrl: upload.objectUrl
  };
}

export async function ingestKnowledgeDocumentAction(documentId: KnowledgeDocumentSnapshot["id"], title: string) {
  await ingestKnowledgeDocument(documentId);

  revalidatePath("/knowledge");

  redirect(`/knowledge?ingest=queued&document=${encodeURIComponent(title)}#knowledge-jobs`);
}

export async function embedKnowledgeChunksAction(formData: FormData) {
  const query = String(formData.get("q") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();

  await embedKnowledgeChunks({
    dimensions: 16,
    limit: 100,
    model: "local-hash-16",
    provider: "local-hash"
  });

  revalidatePath("/knowledge");

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

  redirect(`/knowledge?${params.toString()}#retrieval-preview`);
}
