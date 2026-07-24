import type { KnowledgeDocumentKind, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { assessKnowledgeDocumentReadiness } from "./knowledge-document-readiness";

export interface KnowledgeStarterRequirement {
  acceptedKinds: KnowledgeDocumentKind[];
  id: string;
  searchTerms: string[];
  title: string;
}

export interface KnowledgeStarterReadinessItem extends KnowledgeStarterRequirement {
  done: boolean;
  matchedDocuments: number;
  readyDocuments: number;
}

export interface KnowledgeStarterReadiness {
  completed: number;
  items: KnowledgeStarterReadinessItem[];
  launchReady: boolean;
  missing: number;
  nextActions: KnowledgeStarterNextAction[];
  nextAction: string;
  phase: "empty" | "indexing" | "review" | "launch-ready";
  summary: string;
  total: number;
}

export interface KnowledgeStarterNextAction {
  href: string;
  id: string;
  label: string;
  priority: "high" | "medium" | "low";
  reason: string;
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

export function buildKnowledgeStarterReadiness(documents: KnowledgeDocumentSnapshot[], activeJobCount = 0): KnowledgeStarterReadiness {
  const items = knowledgeStarterRequirements.map((requirement) => {
    const matchedDocuments = documents.filter((document) => matchesRequirement(document, requirement));
    const readyDocuments = matchedDocuments.filter((document) => assessKnowledgeDocumentReadiness(document).status === "ready").length;

    return {
      ...requirement,
      done: readyDocuments > 0,
      matchedDocuments: matchedDocuments.length,
      readyDocuments
    };
  });

  const completed = items.filter((item) => item.done).length;
  const launchState = buildStarterLaunchState({
    activeJobCount,
    completed,
    documents,
    items
  });

  return {
    completed,
    items,
    launchReady: launchState.phase === "launch-ready",
    missing: items.length - completed,
    nextActions: buildStarterNextActions(items, launchState.phase),
    nextAction: launchState.nextAction,
    phase: launchState.phase,
    summary: launchState.summary,
    total: items.length
  };
}

function buildStarterLaunchState({
  activeJobCount,
  completed,
  documents,
  items
}: {
  activeJobCount: number;
  completed: number;
  documents: KnowledgeDocumentSnapshot[];
  items: KnowledgeStarterReadinessItem[];
}): Pick<KnowledgeStarterReadiness, "nextAction" | "phase" | "summary"> {
  const faqReady = Boolean(items.find((item) => item.id === "faq")?.done);
  const companyReady = Boolean(items.find((item) => item.id === "company-information")?.done);
  const starterMinimumMet = completed >= 3 && faqReady;

  if (!documents.length) {
    return {
      nextAction: "Upload an FAQ or company information document first.",
      phase: "empty",
      summary: "No tenant knowledge has been added yet."
    };
  }

  if (activeJobCount > 0) {
    return {
      nextAction: "Wait for indexing to finish, then run an AI answer check.",
      phase: "indexing",
      summary: "AI is indexing your knowledge."
    };
  }

  if (starterMinimumMet) {
    return {
      nextAction: "Install the widget and test a real buyer question.",
      phase: "launch-ready",
      summary: companyReady
        ? "Core documents are ready for Starter Concierge answers."
        : "Core FAQ and buyer documents are ready; company information can follow."
    };
  }

  return {
    nextAction: faqReady ? "Add buying, company, or visa guidance to improve first answers." : "Add an AI-ready FAQ before installing the widget.",
    phase: "review",
    summary: "Knowledge exists, but Starter Concierge still needs stronger coverage."
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

function buildStarterNextActions(items: KnowledgeStarterReadinessItem[], phase: KnowledgeStarterReadiness["phase"]): KnowledgeStarterNextAction[] {
  if (phase === "launch-ready") {
    return [
      {
        href: "#knowledge-chat",
        id: "test-ai-answer",
        label: "Test AI answer",
        priority: "high",
        reason: "Ask a buyer question before copying the widget."
      },
      {
        href: "#retrieval-preview",
        id: "check-retrieval",
        label: "Check retrieval",
        priority: "medium",
        reason: "Confirm Concierge cites the expected private sources."
      }
    ];
  }

  if (phase === "indexing") {
    return [
      {
        href: "#knowledge-jobs",
        id: "watch-indexing",
        label: "Watch indexing",
        priority: "high",
        reason: "Wait until workers finish before testing answers."
      }
    ];
  }

  const missing = items.filter((item) => !item.done);
  const prioritizedIds = ["faq", "company-information", "buying-guide", "visa-guide", "tax-information", "condo-brochures"];
  const sorted = [...missing].sort((left, right) => {
    const leftIndex = prioritizedIds.indexOf(left.id);
    const rightIndex = prioritizedIds.indexOf(right.id);

    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });

  return sorted.slice(0, 3).map((item, index) => ({
    href: "?create=source#create-knowledge-document",
    id: `add-${item.id}`,
    label: `Add ${item.title}`,
    priority: index === 0 ? "high" : "medium",
    reason: item.matchedDocuments
      ? `${item.matchedDocuments} draft source${item.matchedDocuments === 1 ? " needs" : "s need"} stronger AI readiness.`
      : buildMissingSourceReason(item.id)
  }));
}

function buildMissingSourceReason(id: string) {
  const reasons: Record<string, string> = {
    "buying-guide": "Foreign buyers ask this before they trust a viewing.",
    "company-information": "Concierge needs brand, contacts, and handoff context.",
    "condo-brochures": "Project facts improve listing and neighborhood answers.",
    "developer-pdfs": "Construction and handover details reduce agent follow-up.",
    faq: "FAQ is the minimum Starter source for first answers.",
    "internal-instructions": "Guardrails keep Concierge handoffs consistent.",
    "selling-guide": "Seller questions need approved process and commission answers.",
    "tax-information": "Ownership cost answers need agency-approved assumptions.",
    "visa-guide": "Relocation buyers often ask visa questions before property details."
  };

  return reasons[id] ?? "Add this source to improve Concierge coverage.";
}
