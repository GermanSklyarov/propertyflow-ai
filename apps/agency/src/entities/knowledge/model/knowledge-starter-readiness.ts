import type { KnowledgeDocumentKind, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";

export interface KnowledgeStarterRequirement {
  acceptedKinds: KnowledgeDocumentKind[];
  id: string;
  searchTerms: string[];
  title: string;
}

export interface KnowledgeStarterReadinessItem extends KnowledgeStarterRequirement {
  done: boolean;
  matchedDocuments: number;
}

export interface KnowledgeStarterReadiness {
  completed: number;
  items: KnowledgeStarterReadinessItem[];
  missing: number;
  total: number;
}

export const knowledgeStarterRequirements: KnowledgeStarterRequirement[] = [
  {
    acceptedKinds: ["faq"],
    id: "faq",
    searchTerms: ["faq", "frequently asked", "questions", "answers"],
    title: "FAQ"
  },
  {
    acceptedKinds: ["article", "legal", "investment"],
    id: "buying-guide",
    searchTerms: ["buying", "buyer", "purchase", "ownership", "foreign quota"],
    title: "Buying guide"
  },
  {
    acceptedKinds: ["article", "investment"],
    id: "selling-guide",
    searchTerms: ["selling", "seller", "resale", "listing process", "commission"],
    title: "Selling guide"
  },
  {
    acceptedKinds: ["article"],
    id: "company-information",
    searchTerms: ["company", "agency", "about", "team", "contact"],
    title: "Company information"
  },
  {
    acceptedKinds: ["article", "neighborhood"],
    id: "condo-brochures",
    searchTerms: ["condo", "brochure", "project", "development", "facilities"],
    title: "Condo brochures"
  },
  {
    acceptedKinds: ["article", "neighborhood"],
    id: "developer-pdfs",
    searchTerms: ["developer", "pdf", "brochure", "construction", "handover"],
    title: "Developer PDFs"
  },
  {
    acceptedKinds: ["legal", "investment"],
    id: "tax-information",
    searchTerms: ["tax", "transfer fee", "withholding", "specific business tax", "duty"],
    title: "Tax information"
  },
  {
    acceptedKinds: ["legal", "relocation"],
    id: "visa-guide",
    searchTerms: ["visa", "retirement", "elite", "ltr", "work permit"],
    title: "Visa guide"
  },
  {
    acceptedKinds: ["article", "faq"],
    id: "internal-instructions",
    searchTerms: ["internal", "instruction", "script", "handoff", "agent note"],
    title: "Internal instructions"
  }
];

export function buildKnowledgeStarterReadiness(documents: KnowledgeDocumentSnapshot[]): KnowledgeStarterReadiness {
  const items = knowledgeStarterRequirements.map((requirement) => {
    const matchedDocuments = documents.filter((document) => matchesRequirement(document, requirement)).length;

    return {
      ...requirement,
      done: matchedDocuments > 0,
      matchedDocuments
    };
  });

  const completed = items.filter((item) => item.done).length;

  return {
    completed,
    items,
    missing: items.length - completed,
    total: items.length
  };
}

function matchesRequirement(document: KnowledgeDocumentSnapshot, requirement: KnowledgeStarterRequirement) {
  const searchable = normalizeSearchText([document.title, document.kind, ...document.tags].join(" "));
  const kindMatches = requirement.acceptedKinds.includes(document.kind);
  const termMatches = requirement.searchTerms.some((term) => searchable.includes(normalizeSearchText(term)));

  return termMatches || (kindMatches && requirement.id === document.kind);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();
}
