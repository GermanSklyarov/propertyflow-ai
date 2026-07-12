"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreateKnowledgeDocumentRequest, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { createKnowledgeDocument, ingestKnowledgeDocument } from "@shared/api/agency-client";

export async function createKnowledgeDocumentAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en") as CreateKnowledgeDocumentRequest["locale"];
  const kind = String(formData.get("kind") ?? "article") as CreateKnowledgeDocumentRequest["kind"];
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

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

export async function ingestKnowledgeDocumentAction(documentId: KnowledgeDocumentSnapshot["id"], title: string) {
  await ingestKnowledgeDocument(documentId);

  revalidatePath("/knowledge");

  redirect(`/knowledge?ingest=queued&document=${encodeURIComponent(title)}#knowledge-list`);
}
