export type KnowledgeSourceMode = "crm_inventory" | "concierge_index_only" | "hybrid";
export type KnowledgeSourceStatus = "connected" | "indexing" | "ready" | "planned";
export type KnowledgeSourceType = "document" | "property_feed" | "website" | "external";

export interface KnowledgeSourceConnector {
  label: string;
  mode: KnowledgeSourceMode;
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
