export type KnowledgePageNoticeQuery = {
  created?: string;
  document?: string;
  embed?: string;
  error?: string;
  fields?: string;
  ingest?: string;
  items?: string;
  listingPreview?: string;
  listingSync?: string;
  schedule?: string;
  source?: string;
  warnings?: string;
};

export type KnowledgePageNotice = {
  message: string;
  tone: "success" | "warning";
};

export function buildKnowledgePageNotice(query: KnowledgePageNoticeQuery): KnowledgePageNotice | undefined {
  if (query.listingPreview === "ok") {
    return {
      message: `${query.source ?? "REST inventory source"} preview passed: ${query.items ?? "0"} listing rows found and ${query.fields ?? "0"} mapped signals detected.`,
      tone: "success"
    };
  }

  if (query.listingPreview === "warning") {
    return {
      message: `${query.source ?? "REST inventory source"} preview needs review: ${query.items ?? "0"} rows found with ${query.warnings ?? "0"} warnings. Check required fields before syncing.`,
      tone: "warning"
    };
  }

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

  if (query.schedule) {
    return {
      message: `${query.source ?? "REST inventory source"} auto-update is ${formatSchedule(query.schedule)}.`,
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

function formatSchedule(value: string) {
  const labels: Record<string, string> = {
    daily: "set to daily",
    disabled: "disabled",
    every_6_hours: "set to every 6 hours",
    hourly: "set to hourly"
  };

  return labels[value] ?? "updated";
}
