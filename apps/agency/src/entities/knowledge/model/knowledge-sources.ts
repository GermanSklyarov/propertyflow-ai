import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { assessKnowledgeDocumentReadiness } from "./knowledge-document-readiness";

export type KnowledgeSourceMode = "crm_inventory" | "concierge_index_only" | "hybrid";
export type KnowledgeSourceStatus = "connected" | "indexing" | "ready" | "planned";
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

export interface KnowledgeSourcePipelineStep {
  label: string;
  note: string;
}

export interface KnowledgeSourceReadinessSummary {
  actionable: number;
  connected: number;
  indexing: number;
  planned: number;
  ready: number;
  total: number;
}

export interface KnowledgeSourceLaunchGate {
  nextAction: string;
  status: "blocked" | "indexing" | "ready";
  summary: string;
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
      { label: "REST API inventory sync", mode: "concierge_index_only", status: "planned" },
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
      indexing: 0,
      planned: 0,
      ready: 0,
      total: 0
    } satisfies KnowledgeSourceReadinessSummary
  );
}

export function buildKnowledgeSourceLaunchGate(summary: KnowledgeSourceReadinessSummary): KnowledgeSourceLaunchGate {
  if (summary.indexing > 0) {
    return {
      nextAction: "Wait for active ingestion jobs to finish before installing the widget.",
      status: "indexing",
      summary: `${summary.indexing} source${summary.indexing === 1 ? "" : "s"} indexing now`
    };
  }

  if (summary.connected > 0) {
    return {
      nextAction: "Copy the widget once origins and localized messages are configured.",
      status: "ready",
      summary: `${summary.connected} connected source${summary.connected === 1 ? "" : "s"} feeding AI`
    };
  }

  return {
    nextAction: summary.actionable
      ? "Add at least one document, website page, or listing feed before sharing the widget."
      : "Create a knowledge source connector before sharing the widget.",
    status: "blocked",
    summary: "No connected AI sources yet"
  };
}

export function buildRuntimeKnowledgeSourceGroups(
  groups: KnowledgeSourceGroup[],
  input: {
    documents: KnowledgeDocumentSnapshot[];
    jobs: BackgroundJobMonitorItem[];
    totalDocuments: number;
  }
): KnowledgeSourceGroup[] {
  const activeKnowledgeJobs = input.jobs.some(
    (job) => (job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed") && isRunningJob(job)
  );
  const activeImportJobs = input.jobs.some((job) => job.name === "properties.import" && isRunningJob(job));
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

  return groups.map((group) => {
    if (group.type === "document") {
      return {
        ...group,
        connectors: group.connectors.map((connector, index) => {
          if (index === 0) {
            return buildRuntimeDocumentConnector({
              activeKnowledgeJobs,
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
          if (connector.label !== "CSV upload with field mapping") {
            return connector;
          }

          const totalListingKnowledge = listingKnowledgeDocuments || recentImportKnowledgeDocuments;

          return {
            ...connector,
            countLabel: `${totalListingKnowledge} listing docs`,
            runtimeNote: activeImportJobs
              ? "Import is indexing listing knowledge"
              : totalListingKnowledge
                ? "Feeds Concierge without forcing CRM"
                : "Upload CSV, JSON, or feed data",
            status: activeImportJobs ? "indexing" : totalListingKnowledge ? "connected" : connector.status
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
              connectedNote: "FAQ pages ready for Concierge",
              connector,
              matchedCount: websiteFaqDocuments,
              readyCount: readyWebsiteFaqDocuments
            });
          }

          if (connector.label === "Blog article import") {
            return buildRuntimeWebsiteConnector({
              activeKnowledgeJobs,
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

function buildRuntimeDocumentConnector(input: {
  activeKnowledgeJobs: boolean;
  connectedNote: string;
  connector: KnowledgeSourceConnector;
  emptyNote: string;
  matchedCount: number;
  readyCount: number;
  unit: string;
}): KnowledgeSourceConnector {
  return {
    ...input.connector,
    countLabel: `${input.readyCount}/${input.matchedCount} ready ${input.unit}`,
    runtimeNote: input.activeKnowledgeJobs
      ? "Indexing tenant uploads now"
      : input.readyCount
        ? input.connectedNote
        : input.matchedCount
          ? "Review document readiness before widget launch"
          : input.emptyNote,
    status: input.activeKnowledgeJobs ? "indexing" : input.readyCount ? "connected" : input.connector.status
  };
}

function buildRuntimeWebsiteConnector(input: {
  activeKnowledgeJobs: boolean;
  connectedNote: string;
  connector: KnowledgeSourceConnector;
  matchedCount: number;
  readyCount: number;
}): KnowledgeSourceConnector {
  return {
    ...input.connector,
    countLabel: `${input.readyCount}/${input.matchedCount} ready pages`,
    runtimeNote: input.activeKnowledgeJobs
      ? "Indexing website source content"
      : input.readyCount
        ? input.connectedNote
        : input.matchedCount
          ? "Review source text, tags, and URL before widget launch"
          : "Paste page copy or upload HTML",
    status: input.activeKnowledgeJobs ? "indexing" : input.readyCount ? "connected" : input.connector.status
  };
}

function countDocumentsWithTags(documents: KnowledgeDocumentSnapshot[], tags: string[]) {
  return documents.filter((document) => tags.some((tag) => document.tags.includes(tag))).length;
}

function countReadyDocumentsWithTags(documents: KnowledgeDocumentSnapshot[], tags: string[]) {
  return documents.filter((document) => tags.some((tag) => document.tags.includes(tag)) && isAiReadyDocument(document)).length;
}

function isAiReadyDocument(document: KnowledgeDocumentSnapshot) {
  return assessKnowledgeDocumentReadiness(document).status === "ready";
}

function isRunningJob(job: BackgroundJobMonitorItem) {
  return job.state === "active" || job.state === "waiting" || job.state === "delayed";
}

function getResultNumber(result: BackgroundJobMonitorItem["result"], key: string) {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return 0;
  }

  const value = (result as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
