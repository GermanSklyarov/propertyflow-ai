export type KnowledgePageNoticeQuery = {
  created?: string;
  document?: string;
  embed?: string;
  error?: string;
  ingest?: string;
  listingSync?: string;
  source?: string;
};

export type KnowledgePageNotice = {
  message: string;
  tone: "success" | "warning";
};

export function buildKnowledgePageNotice(query: KnowledgePageNoticeQuery): KnowledgePageNotice | undefined {
  if (query.listingSync === "invalid") {
    return {
      message: query.error ?? "REST inventory source could not be saved. Check the mapping and try again.",
      tone: "warning"
    };
  }

  if (query.listingSync === "queued") {
    return {
      message: `${query.source ?? "REST inventory source"} sync was queued. Worker progress appears below.`,
      tone: "success"
    };
  }

  if (query.created && query.ingest === "queued") {
    return {
      message: `${query.created} was added. AI is indexing this source now, and worker progress appears below.`,
      tone: "success"
    };
  }

  if (query.created) {
    return {
      message: `${query.created} was added to the agency knowledge base.`,
      tone: "success"
    };
  }

  if (query.ingest === "queued") {
    return {
      message: `${query.document ?? "Knowledge document"} was queued for re-ingestion. Worker progress appears below.`,
      tone: "success"
    };
  }

  if (query.embed === "queued") {
    return {
      message: "Knowledge chunk embedding was queued for the current tenant.",
      tone: "success"
    };
  }

  return undefined;
}
