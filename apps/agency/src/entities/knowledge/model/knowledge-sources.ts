import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";

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
  const websiteFaqDocuments = countDocumentsWithTags(input.documents, ["source:website-faq-pages", "faq-page"]);
  const websiteArticleDocuments = countDocumentsWithTags(input.documents, ["source:website-blog-articles", "blog"]);
  const uploadedKnowledgeDocuments = Math.max(input.totalDocuments - listingKnowledgeDocuments, 0);
  const recentImportKnowledgeDocuments = input.jobs
    .filter((job) => job.name === "properties.import")
    .reduce((total, job) => total + getResultNumber(job.result, "knowledgeDocumentsCreated"), 0);

  return groups.map((group) => {
    if (group.type === "document") {
      return {
        ...group,
        connectors: group.connectors.map((connector, index) => ({
          ...connector,
          countLabel: index === 0 ? `${uploadedKnowledgeDocuments} docs` : connector.countLabel,
          runtimeNote:
            index === 0
              ? activeKnowledgeJobs
                ? "Indexing tenant uploads now"
                : uploadedKnowledgeDocuments
                  ? "Available to AI Concierge"
                  : "Upload PDFs or guides to start"
              : connector.runtimeNote,
          status: activeKnowledgeJobs ? "indexing" : uploadedKnowledgeDocuments ? "connected" : connector.status
        }))
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
            return buildRuntimeWebsiteConnector(connector, websiteFaqDocuments, activeKnowledgeJobs, "FAQ pages ready for Concierge");
          }

          if (connector.label === "Blog article import") {
            return buildRuntimeWebsiteConnector(connector, websiteArticleDocuments, activeKnowledgeJobs, "Website articles ready for Concierge");
          }

          return connector;
        })
      };
    }

    return group;
  });
}

function buildRuntimeWebsiteConnector(
  connector: KnowledgeSourceConnector,
  count: number,
  activeKnowledgeJobs: boolean,
  connectedNote: string
): KnowledgeSourceConnector {
  return {
    ...connector,
    countLabel: `${count} pages`,
    runtimeNote: activeKnowledgeJobs ? "Indexing website source content" : count ? connectedNote : "Paste page copy or upload HTML",
    status: activeKnowledgeJobs ? "indexing" : count ? "connected" : connector.status
  };
}

function countDocumentsWithTags(documents: KnowledgeDocumentSnapshot[], tags: string[]) {
  return documents.filter((document) => tags.some((tag) => document.tags.includes(tag))).length;
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
