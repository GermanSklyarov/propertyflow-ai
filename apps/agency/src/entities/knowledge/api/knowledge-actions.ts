"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreateKnowledgeDocumentRequest, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { createKnowledgeDocument, embedKnowledgeChunks, ingestKnowledgeDocument } from "@shared/api/agency-client";
import { resolveKnowledgeDocumentBody } from "../model/knowledge-document-draft";

export async function createKnowledgeDocumentAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const typedBody = String(formData.get("body") ?? "").trim();
  const sourceFile = getSourceFile(formData.get("sourceFile"));
  const body = await resolveKnowledgeDocumentBody(typedBody, sourceFile);
  const locale = String(formData.get("locale") ?? "en") as CreateKnowledgeDocumentRequest["locale"];
  const kind = String(formData.get("kind") ?? "article") as CreateKnowledgeDocumentRequest["kind"];
  const tags = [
    ...String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    ...(sourceFile ? ["source-file", sourceFile.name] : [])
  ];

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

  revalidatePath("/knowledge");

  redirect(`/knowledge?created=${encodeURIComponent(document.title)}#knowledge-list`);
}

function getSourceFile(value: FormDataEntryValue | null): File | null {
  return typeof File !== "undefined" && value instanceof File && value.size > 0 ? value : null;
}

export async function ingestKnowledgeDocumentAction(documentId: KnowledgeDocumentSnapshot["id"], title: string) {
  await ingestKnowledgeDocument(documentId);

  revalidatePath("/knowledge");

  redirect(`/knowledge?ingest=queued&document=${encodeURIComponent(title)}#knowledge-list`);
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
