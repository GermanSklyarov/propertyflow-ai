import type { CreateKnowledgeDocumentRequest, KnowledgeDocumentKind } from "@propertyflow/contracts";

export interface KnowledgeDocumentSourcePreset {
  defaultKind: KnowledgeDocumentKind;
  description: string;
  id: string;
  tags: string[];
  title: string;
}

export const knowledgeDocumentSourcePresets: KnowledgeDocumentSourcePreset[] = [
  {
    defaultKind: "faq",
    description: "Client questions, objection handling, booking rules, and common agency answers.",
    id: "faq",
    tags: ["faq", "questions", "answers"],
    title: "FAQ"
  },
  {
    defaultKind: "legal",
    description: "Foreign ownership, transfer process, quota, due diligence, and buyer documents.",
    id: "buying-guide",
    tags: ["buying", "buyer", "purchase", "ownership", "foreign-quota"],
    title: "Buying guide"
  },
  {
    defaultKind: "investment",
    description: "Seller process, resale strategy, commissions, listing steps, and owner expectations.",
    id: "selling-guide",
    tags: ["selling", "seller", "resale", "commission"],
    title: "Selling guide"
  },
  {
    defaultKind: "article",
    description: "Company story, contacts, office hours, handoff rules, team, and brand facts.",
    id: "company-information",
    tags: ["company", "agency", "team", "contact"],
    title: "Company information"
  },
  {
    defaultKind: "neighborhood",
    description: "Condo facilities, development facts, brochure copy, and project positioning.",
    id: "condo-brochures",
    tags: ["condo", "brochure", "project", "development", "facilities"],
    title: "Condo brochures"
  },
  {
    defaultKind: "neighborhood",
    description: "Developer PDFs, construction status, handover notes, and project catalog content.",
    id: "developer-pdfs",
    tags: ["developer", "pdf", "brochure", "construction", "handover"],
    title: "Developer PDFs"
  },
  {
    defaultKind: "legal",
    description: "Transfer fees, withholding tax, specific business tax, stamp duty, and ownership costs.",
    id: "tax-information",
    tags: ["tax", "transfer-fee", "withholding", "specific-business-tax", "stamp-duty"],
    title: "Tax information"
  },
  {
    defaultKind: "relocation",
    description: "Visa, retirement, LTR, Elite, work permit, and relocation planning notes.",
    id: "visa-guide",
    tags: ["visa", "retirement", "elite", "ltr", "work-permit", "relocation"],
    title: "Visa guide"
  },
  {
    defaultKind: "faq",
    description: "Internal scripts, agent instructions, lead handoff rules, and concierge guardrails.",
    id: "internal-instructions",
    tags: ["internal", "instructions", "script", "handoff", "agent-note"],
    title: "Internal instructions"
  },
  {
    defaultKind: "faq",
    description: "Existing website FAQ pages copied into the same AI retrieval layer as uploaded documents.",
    id: "website-faq-pages",
    tags: ["website", "faq-page", "public-site", "source-url"],
    title: "Website FAQ pages"
  },
  {
    defaultKind: "article",
    description: "Blog articles, area guides, and public website content that should answer client questions.",
    id: "website-blog-articles",
    tags: ["website", "blog", "article", "public-site", "source-url"],
    title: "Website blog articles"
  },
  {
    defaultKind: "article",
    description: "Use this for one-off knowledge that does not belong to the starter checklist.",
    id: "custom",
    tags: ["custom-source"],
    title: "Custom source"
  }
];

export function resolveKnowledgeSourceKind(
  sourcePresetId: string | undefined,
  fallbackKind: CreateKnowledgeDocumentRequest["kind"]
): CreateKnowledgeDocumentRequest["kind"] {
  return getKnowledgeDocumentSourcePreset(sourcePresetId)?.defaultKind ?? fallbackKind;
}

export function buildKnowledgeSourceTags(input: {
  sourceFileName?: string;
  sourcePresetId?: string;
  storageBacked?: boolean;
  typedTags: string;
}) {
  const preset = getKnowledgeDocumentSourcePreset(input.sourcePresetId);
  const typedTags = input.typedTags
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter(Boolean);

  return uniqueStrings([
    ...(preset ? [`source:${preset.id}`, ...preset.tags] : []),
    ...typedTags,
    ...(input.sourceFileName ? ["source-file", normalizeTag(input.sourceFileName)] : []),
    ...(input.storageBacked ? ["storage-backed"] : [])
  ]);
}

function getKnowledgeDocumentSourcePreset(sourcePresetId: string | undefined) {
  return knowledgeDocumentSourcePresets.find((preset) => preset.id === sourcePresetId);
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
