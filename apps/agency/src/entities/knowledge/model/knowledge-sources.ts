import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";

export type KnowledgeSourceMode = "crm_inventory" | "concierge_index_only" | "hybrid";
export type KnowledgeSourceStatus = "connected" | "indexing" | "ready" | "planned";
export type KnowledgeSourceType = "document" | "property_feed" | "website" | "external";

export interface KnowledgeSourceConnector {
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

export const knowledgeSourceGroups: KnowledgeSourceGroup[] = [
  {
    connectors: [
      { label: "PDF / DOCX / text upload", mode: "concierge_index_only", status: "ready" },
      { label: "FAQ, buying, visa, tax guides", mode: "concierge_index_only", status: "ready" },
      { label: "Developer and condo brochures", mode: "concierge_index_only", status: "ready" }
    ],
    description: "Agency-approved documents become searchable knowledge for Concierge answers.",
    title: "Documents",
    type: "document"
  },
  {
    connectors: [
      { label: "CSV upload with field mapping", mode: "hybrid", status: "ready" },
      { label: "REST API inventory sync", mode: "concierge_index_only", status: "planned" },
      { label: "XML feed import", mode: "concierge_index_only", status: "planned" }
    ],
    description: "Listings can feed Concierge search without forcing the agency to adopt our CRM first.",
    title: "Property Listings",
    type: "property_feed"
  },
  {
    connectors: [
      { label: "FAQ pages", mode: "concierge_index_only", status: "planned" },
      { label: "Blog article import", mode: "concierge_index_only", status: "planned" },
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

    return group;
  });
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
