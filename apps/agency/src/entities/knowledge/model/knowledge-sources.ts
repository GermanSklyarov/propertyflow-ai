import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot, ListingSourceSnapshot } from "@propertyflow/contracts";
import { isRunningBackgroundJob } from "@entities/jobs/model/background-jobs";
import { assessKnowledgeDocumentReadiness } from "./knowledge-document-readiness";

export type KnowledgeSourceMode = "crm_inventory" | "concierge_index_only" | "hybrid";
export type KnowledgeSourceStatus = "connected" | "disabled" | "draft" | "failed" | "indexing" | "ready" | "planned";
export type KnowledgeSourceType = "document" | "property_feed" | "website" | "external";

export interface KnowledgeSourceConnector {
  actionHref?: string;
  actionLabel?: string;
  countLabel?: string;
  label: string;
  mode: KnowledgeSourceMode;
  runtimeNote?: string;
  status: KnowledgeSourceStatus;
}

export interface KnowledgeSourceGroup {
  connectors: KnowledgeSourceConnector[];
  description: string;
  title: string;
  type: KnowledgeSourceType;
}

export interface KnowledgeSourceGroupAction {
  href: string;
  label: string;
}

export interface KnowledgeSourcePipelineStep {
  label: string;
  note: string;
}

export interface KnowledgeSourceReadinessSummary {
  actionable: number;
  connected: number;
  disabled: number;
  draft: number;
  failed: number;
  indexing: number;
  planned: number;
  ready: number;
  total: number;
}

export interface KnowledgeSourceLaunchGate {
  actionHref: string;
  actionLabel: string;
  nextAction: string;
  status: "blocked" | "failed" | "indexing" | "ready";
  summary: string;
}

export interface KnowledgeSourceLaunchGateOptions {
  starterLaunchReady?: boolean;
  starterNextAction?: string;
  starterSummary?: string;
}

export interface KnowledgeSourceCoverageItem {
  action?: KnowledgeSourceGroupAction;
  connected: number;
  description: string;
  disabled: number;
  draft: number;
  failed: number;
  indexing: number;
  label: string;
  planned: number;
  ready: number;
  status: "connected" | "disabled" | "draft" | "failed" | "indexing" | "ready" | "planned";
  total: number;
  type: KnowledgeSourceType;
}

export const knowledgeSourceGroups: KnowledgeSourceGroup[] = [
  {
    connectors: [
      {
        actionHref: "#create-knowledge-document",
        actionLabel: "Add document",
        label: "PDF / DOCX / text upload",
        mode: "concierge_index_only",
        status: "ready"
      },
      {
        actionHref: "#create-knowledge-document",
        actionLabel: "Add guide",
        label: "FAQ, buying, visa, tax guides",
        mode: "concierge_index_only",
        status: "ready"
      },
      {
        actionHref: "#create-knowledge-document",
        actionLabel: "Add brochure",
        label: "Developer and condo brochures",
        mode: "concierge_index_only",
        status: "ready"
      }
    ],
    description: "Agency-approved documents become searchable knowledge for Concierge answers.",
    title: "Documents",
    type: "document"
  },
  {
    connectors: [
      {
        actionHref: "/listings#import-listings",
        actionLabel: "Open importer",
        label: "CSV upload with field mapping",
        mode: "hybrid",
        status: "ready"
      },
      {
        actionHref: "#listing-api-sources",
        actionLabel: "Manage APIs",
        label: "REST API inventory sync",
        mode: "concierge_index_only",
        status: "ready"
      },
      { label: "XML feed import", mode: "concierge_index_only", status: "planned" }
    ],
    description: "Listings can feed Concierge search without forcing the agency to adopt our CRM first.",
    title: "Property Listings",
    type: "property_feed"
  },
  {
    connectors: [
      {
        actionHref: "#create-knowledge-document",
        actionLabel: "Add website FAQ",
        label: "FAQ pages",
        mode: "concierge_index_only",
        status: "ready"
      },
      {
        actionHref: "#create-knowledge-document",
        actionLabel: "Add article",
        label: "Blog article import",
        mode: "concierge_index_only",
        status: "ready"
      },
      { label: "Sitemap crawler", mode: "concierge_index_only", status: "planned" }
    ],
    description: "Existing website content becomes part of the same retrieval layer as uploaded documents.",
    title: "Website",
    type: "website"
  },
  {
    connectors: [
      { label: "Developer catalog", mode: "concierge_index_only", status: "planned" },
      { label: "Market reports", mode: "concierge_index_only", status: "planned" },
      { label: "Public policy and relocation sources", mode: "concierge_index_only", status: "planned" }
    ],
    description: "Curated external sources enrich answers without mixing them into agency CRM records.",
    title: "External Sources",
    type: "external"
  }
];

export const knowledgeSourcePipeline: KnowledgeSourcePipelineStep[] = [
  { label: "Source", note: "Document, listing feed, website page, or external catalog." },
  { label: "Ingestion", note: "Store raw source and normalize source metadata." },
  { label: "Parsing", note: "Extract text, structured listing fields, or website content." },
  { label: "Embeddings", note: "Chunk content and write vector-search-ready records." },
  { label: "AI Concierge", note: "Answer from private tenant context before CRM is required." }
];

export function summarizeKnowledgeSourceModes(groups: KnowledgeSourceGroup[]) {
  return groups.reduce(
    (summary, group) => {
      for (const connector of group.connectors) {
        summary[connector.mode] += 1;
      }

      return summary;
    },
    {
      concierge_index_only: 0,
      crm_inventory: 0,
      hybrid: 0
    } satisfies Record<KnowledgeSourceMode, number>
  );
}

export function summarizeKnowledgeSourceReadiness(groups: KnowledgeSourceGroup[]): KnowledgeSourceReadinessSummary {
  return groups.reduce(
    (summary, group) => {
      for (const connector of group.connectors) {
        summary.total += 1;

        if (connector.actionHref) {
          summary.actionable += 1;
        }

        summary[connector.status] += 1;
      }

      return summary;
    },
    {
      actionable: 0,
      connected: 0,
      disabled: 0,
      draft: 0,
      failed: 0,
      indexing: 0,
      planned: 0,
      ready: 0,
      total: 0
    } satisfies KnowledgeSourceReadinessSummary
  );
}

export function buildKnowledgeSourceLaunchGate(
  summary: KnowledgeSourceReadinessSummary,
  options: KnowledgeSourceLaunchGateOptions = {}
): KnowledgeSourceLaunchGate {
  const starterLaunchReady = options.starterLaunchReady ?? true;

  if (summary.failed > 0) {
    return {
      actionHref: "#knowledge-jobs",
      actionLabel: "View jobs",
      nextAction: "Open failed ingestion jobs and retry or disable the broken source before installing the widget.",
      status: "failed",
      summary: `${summary.failed} source${summary.failed === 1 ? " needs" : "s need"} attention`
    };
  }

  if (summary.indexing > 0) {
    return {
      actionHref: "#knowledge-jobs",
      actionLabel: "View jobs",
      nextAction: "Wait for active ingestion jobs to finish before installing the widget.",
      status: "indexing",
      summary: `${summary.indexing} source${summary.indexing === 1 ? "" : "s"} indexing now`
    };
  }

  if (summary.connected > 0 && !starterLaunchReady) {
    return {
      actionHref: "?create=source#create-knowledge-document",
      actionLabel: "Add source",
      nextAction: options.starterNextAction ?? "Finish Starter knowledge coverage before installing the widget.",
      status: "blocked",
      summary: options.starterSummary ?? "Connected sources still need Starter launch coverage"
    };
  }

  if (summary.connected > 0) {
    return {
      actionHref: "/settings#widget-install",
      actionLabel: "Open widget",
      nextAction: "Copy the widget once origins and localized messages are configured.",
      status: "ready",
      summary: `${summary.connected} connected source${summary.connected === 1 ? "" : "s"} feeding AI`
    };
  }

  return {
    actionHref: "?create=source#create-knowledge-document",
    actionLabel: summary.actionable ? "Add source" : "Create connector",
    nextAction: summary.actionable
      ? "Add at least one document, website page, or listing feed before sharing the widget."
      : "Create a knowledge source connector before sharing the widget.",
    status: "blocked",
    summary: "No connected AI sources yet"
  };
}

export function buildKnowledgeSourceGroupAction(group: KnowledgeSourceGroup): KnowledgeSourceGroupAction | undefined {
  const connector = group.connectors.find((item) => item.actionHref && item.status !== "planned");

  if (!connector?.actionHref) {
    return undefined;
  }

  return {
    href: connector.actionHref,
    label: connector.actionLabel ?? "Open source"
  };
}

export function buildKnowledgeSourceCoverage(groups: KnowledgeSourceGroup[]): KnowledgeSourceCoverageItem[] {
  return groups.map((group) => {
    const summary = summarizeKnowledgeSourceReadiness([group]);

    return {
      action: buildKnowledgeSourceGroupAction(group),
      connected: summary.connected,
      description: buildKnowledgeSourceCoverageDescription(summary),
      disabled: summary.disabled,
      draft: summary.draft,
      failed: summary.failed,
      indexing: summary.indexing,
      label: group.title,
      planned: summary.planned,
      ready: summary.ready,
      status: buildKnowledgeSourceCoverageStatus(summary),
      total: summary.total,
      type: group.type
    };
  });
}

export function buildRuntimeKnowledgeSourceGroups(
  groups: KnowledgeSourceGroup[],
  input: {
    documents: KnowledgeDocumentSnapshot[];
    jobs: BackgroundJobMonitorItem[];
    listingSources?: ListingSourceSnapshot[];
    totalDocuments: number;
  }
): KnowledgeSourceGroup[] {
  const activeKnowledgeJobs = input.jobs.some(
    (job) => (job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed") && isRunningBackgroundJob(job)
  );
  const activeImportJobs = input.jobs.some(
    (job) => job.name === "properties.import" && getBackgroundJobPayloadSource(job) !== "partner-api" && isRunningBackgroundJob(job)
  );
  const failedKnowledgeJobs = input.jobs.some(
    (job) => (job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed") && job.state === "failed"
  );
  const failedImportJobs = input.jobs.some(
    (job) => job.name === "properties.import" && getBackgroundJobPayloadSource(job) !== "partner-api" && job.state === "failed"
  );
  const activePartnerImportJobs = input.jobs.some(
    (job) => job.name === "properties.import" && getBackgroundJobPayloadSource(job) === "partner-api" && isRunningBackgroundJob(job)
  );
  const failedPartnerImportJobs = input.jobs.some(
    (job) => job.name === "properties.import" && getBackgroundJobPayloadSource(job) === "partner-api" && job.state === "failed"
  );
  const listingKnowledgeDocuments = input.documents.filter((document) => document.tags.includes("property-listing")).length;
  const readyGuideDocuments = countReadyDocumentsWithTags(input.documents, [
    "faq",
    "source:faq",
    "source:buying-guide",
    "source:selling-guide",
    "source:visa-guide",
    "source:tax-information",
    "buying",
    "selling",
    "visa",
    "tax"
  ]);
  const matchedGuideDocuments = countDocumentsWithTags(input.documents, [
    "faq",
    "source:faq",
    "source:buying-guide",
    "source:selling-guide",
    "source:visa-guide",
    "source:tax-information",
    "buying",
    "selling",
    "visa",
    "tax"
  ]);
  const readyBrochureDocuments = countReadyDocumentsWithTags(input.documents, [
    "brochure",
    "condo",
    "developer",
    "source:condo-brochures",
    "source:developer-pdfs"
  ]);
  const matchedBrochureDocuments = countDocumentsWithTags(input.documents, [
    "brochure",
    "condo",
    "developer",
    "source:condo-brochures",
    "source:developer-pdfs"
  ]);
  const websiteFaqDocuments = countDocumentsWithTags(input.documents, ["source:website-faq-pages", "faq-page"]);
  const readyWebsiteFaqDocuments = countReadyDocumentsWithTags(input.documents, ["source:website-faq-pages", "faq-page"]);
  const websiteArticleDocuments = countDocumentsWithTags(input.documents, ["source:website-blog-articles", "blog"]);
  const readyWebsiteArticleDocuments = countReadyDocumentsWithTags(input.documents, ["source:website-blog-articles", "blog"]);
  const uploadedKnowledgeDocuments = Math.max(input.totalDocuments - listingKnowledgeDocuments, 0);
  const readyUploadedKnowledgeDocuments = input.documents.filter((document) => !document.tags.includes("property-listing") && isAiReadyDocument(document)).length;
  const recentImportKnowledgeDocuments = input.jobs
    .filter((job) => job.name === "properties.import")
    .reduce((total, job) => total + getResultNumber(job.result, "knowledgeDocumentsCreated"), 0);
  const listingSources = input.listingSources ?? [];
  const activeListingSources = listingSources.filter((source) => source.status !== "disabled");
  const connectedListingSources = activeListingSources.filter((source) => source.status === "connected" || source.status === "syncing");
  const failedListingSources = activeListingSources.filter((source) => source.status === "failed");
  const listingSourceCanonicalFields = activeListingSources.reduce(
    (total, source) =>
      total +
      Object.values(source.mapping.canonical).filter((sourcePath) => typeof sourcePath === "string" && sourcePath.trim().length > 0).length,
    0
  );
  const listingSourceCustomAttributes = activeListingSources.reduce(
    (total, source) => total + (source.mapping.customAttributes?.length ?? 0),
    0
  );

  return groups.map((group) => {
    if (group.type === "document") {
      return {
        ...group,
        connectors: group.connectors.map((connector, index) => {
          if (index === 0) {
            return buildRuntimeDocumentConnector({
              activeKnowledgeJobs,
              failedKnowledgeJobs,
              connectedNote: "Available to AI Concierge",
              connector,
              emptyNote: "Upload PDFs or guides to start",
              matchedCount: uploadedKnowledgeDocuments,
              readyCount: readyUploadedKnowledgeDocuments,
              unit: "docs"
            });
          }

          if (connector.label === "FAQ, buying, visa, tax guides") {
            return buildRuntimeDocumentConnector({
              activeKnowledgeJobs,
              failedKnowledgeJobs,
              connectedNote: "Starter guides are ready for Concierge answers",
              connector,
              emptyNote: "Add FAQ, buying, visa, or tax guides",
              matchedCount: matchedGuideDocuments,
              readyCount: readyGuideDocuments,
              unit: "guides"
            });
          }

          if (connector.label === "Developer and condo brochures") {
            return buildRuntimeDocumentConnector({
              activeKnowledgeJobs,
              failedKnowledgeJobs,
              connectedNote: "Project brochures are ready for property questions",
              connector,
              emptyNote: "Add developer PDFs or condo brochures",
              matchedCount: matchedBrochureDocuments,
              readyCount: readyBrochureDocuments,
              unit: "brochures"
            });
          }

          return connector;
        })
      };
    }

    if (group.type === "property_feed") {
      return {
        ...group,
        connectors: group.connectors.map((connector) => {
          if (connector.label === "REST API inventory sync") {
            return buildRuntimeListingSourceConnector({
              activeImportJobs: activePartnerImportJobs,
              connectedCount: connectedListingSources.length,
              connector,
              failedCount: failedListingSources.length,
              failedImportJobs: failedPartnerImportJobs,
              sourceCount: activeListingSources.length,
              totalCanonicalFields: listingSourceCanonicalFields,
              totalCustomAttributes: listingSourceCustomAttributes
            });
          }

          if (connector.label !== "CSV upload with field mapping") {
            return connector;
          }

          const totalListingKnowledge = listingKnowledgeDocuments || recentImportKnowledgeDocuments;

          return {
            ...connector,
            countLabel: `${totalListingKnowledge} listing docs`,
            runtimeNote: failedImportJobs
              ? "Last import failed; review job details"
              : activeImportJobs
                ? "Import is indexing listing knowledge"
                : totalListingKnowledge
                  ? "Feeds Concierge without forcing CRM"
                  : "Upload CSV, JSON, or feed data",
            status: failedImportJobs ? "failed" : activeImportJobs ? "indexing" : totalListingKnowledge ? "connected" : connector.status
          };
        })
      };
    }

    if (group.type === "website") {
      return {
        ...group,
        connectors: group.connectors.map((connector) => {
          if (connector.label === "FAQ pages") {
            return buildRuntimeWebsiteConnector({
              activeKnowledgeJobs,
              failedKnowledgeJobs,
              connectedNote: "FAQ pages ready for Concierge",
              connector,
              matchedCount: websiteFaqDocuments,
              readyCount: readyWebsiteFaqDocuments
            });
          }

          if (connector.label === "Blog article import") {
            return buildRuntimeWebsiteConnector({
              activeKnowledgeJobs,
              failedKnowledgeJobs,
              connectedNote: "Website articles ready for Concierge",
              connector,
              matchedCount: websiteArticleDocuments,
              readyCount: readyWebsiteArticleDocuments
            });
          }

          return connector;
        })
      };
    }

    return group;
  });
}

function buildRuntimeListingSourceConnector(input: {
  activeImportJobs: boolean;
  connectedCount: number;
  connector: KnowledgeSourceConnector;
  failedCount: number;
  failedImportJobs: boolean;
  sourceCount: number;
  totalCanonicalFields: number;
  totalCustomAttributes: number;
}): KnowledgeSourceConnector {
  const healthyCount = input.connectedCount || input.sourceCount;

  return {
    ...input.connector,
    countLabel: `${input.sourceCount} API source${input.sourceCount === 1 ? "" : "s"}`,
    runtimeNote: input.failedImportJobs || input.failedCount
      ? "Last API sync failed; review source mapping or credentials"
      : input.activeImportJobs
        ? "REST feed is syncing listing knowledge"
        : healthyCount
          ? buildListingSourceMappingNote(input.totalCanonicalFields, input.totalCustomAttributes)
          : "Connect REST inventory without migrating CRM",
    status: input.failedImportJobs || input.failedCount
      ? "failed"
      : input.activeImportJobs
        ? "indexing"
        : input.connectedCount
          ? "connected"
          : input.sourceCount
            ? "draft"
            : input.connector.status
  };
}

function buildListingSourceMappingNote(canonicalFields: number, customAttributes: number) {
  const mappedFields = canonicalFields ? `${canonicalFields} mapped fields` : "canonical field mapping";
  const customFields = customAttributes ? `${customAttributes} custom attributes` : "custom agency attributes";

  return `${mappedFields} and ${customFields} feed Concierge search`;
}

function buildRuntimeDocumentConnector(input: {
  activeKnowledgeJobs: boolean;
  connectedNote: string;
  connector: KnowledgeSourceConnector;
  emptyNote: string;
  failedKnowledgeJobs: boolean;
  matchedCount: number;
  readyCount: number;
  unit: string;
}): KnowledgeSourceConnector {
  return {
    ...input.connector,
    countLabel: `${input.readyCount}/${input.matchedCount} ready ${input.unit}`,
    runtimeNote: input.failedKnowledgeJobs
      ? "Last ingestion failed; review job details"
      : input.activeKnowledgeJobs
        ? "Indexing tenant uploads now"
        : input.readyCount
          ? input.connectedNote
          : input.matchedCount
            ? "Review document readiness before widget launch"
            : input.emptyNote,
    status: input.failedKnowledgeJobs ? "failed" : input.activeKnowledgeJobs ? "indexing" : input.readyCount ? "connected" : input.connector.status
  };
}

function buildRuntimeWebsiteConnector(input: {
  activeKnowledgeJobs: boolean;
  connectedNote: string;
  connector: KnowledgeSourceConnector;
  failedKnowledgeJobs: boolean;
  matchedCount: number;
  readyCount: number;
}): KnowledgeSourceConnector {
  return {
    ...input.connector,
    countLabel: `${input.readyCount}/${input.matchedCount} ready pages`,
    runtimeNote: input.failedKnowledgeJobs
      ? "Last website ingestion failed; review job details"
      : input.activeKnowledgeJobs
        ? "Indexing website source content"
        : input.readyCount
          ? input.connectedNote
          : input.matchedCount
            ? "Review source text, tags, and URL before widget launch"
            : "Paste page copy or upload HTML",
    status: input.failedKnowledgeJobs ? "failed" : input.activeKnowledgeJobs ? "indexing" : input.readyCount ? "connected" : input.connector.status
  };
}

function countDocumentsWithTags(documents: KnowledgeDocumentSnapshot[], tags: string[]) {
  return documents.filter((document) => tags.some((tag) => document.tags.includes(tag))).length;
}

function countReadyDocumentsWithTags(documents: KnowledgeDocumentSnapshot[], tags: string[]) {
  return documents.filter((document) => tags.some((tag) => document.tags.includes(tag)) && isAiReadyDocument(document)).length;
}

function getBackgroundJobPayloadSource(job: BackgroundJobMonitorItem) {
  if (!job.payload || typeof job.payload !== "object" || !("source" in job.payload)) {
    return "";
  }

  const source = (job.payload as { source?: unknown }).source;

  return typeof source === "string" ? source : "";
}

function isAiReadyDocument(document: KnowledgeDocumentSnapshot) {
  return assessKnowledgeDocumentReadiness(document).status === "ready";
}

function buildKnowledgeSourceCoverageStatus(summary: KnowledgeSourceReadinessSummary): KnowledgeSourceCoverageItem["status"] {
  if (summary.indexing > 0) {
    return "indexing";
  }

  if (summary.failed > 0) {
    return "failed";
  }

  if (summary.connected > 0) {
    return "connected";
  }

  if (summary.ready > 0 || summary.actionable > 0) {
    return "ready";
  }

  if (summary.draft > 0) {
    return "draft";
  }

  if (summary.disabled > 0) {
    return "disabled";
  }

  return "planned";
}

function buildKnowledgeSourceCoverageDescription(summary: KnowledgeSourceReadinessSummary) {
  if (summary.failed > 0) {
    return `${summary.failed} failed, ${summary.connected} still connected`;
  }

  if (summary.indexing > 0) {
    return `${summary.indexing} indexing, ${summary.connected} already connected`;
  }

  if (summary.connected > 0) {
    return `${summary.connected}/${summary.total} sources feeding AI`;
  }

  if (summary.ready > 0 || summary.actionable > 0) {
    return `${summary.actionable} setup path${summary.actionable === 1 ? "" : "s"} available`;
  }

  return `${summary.planned} planned connector${summary.planned === 1 ? "" : "s"}`;
}

function getResultNumber(result: BackgroundJobMonitorItem["result"], key: string) {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return 0;
  }

  const value = (result as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
