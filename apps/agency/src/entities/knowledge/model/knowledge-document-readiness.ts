import type { KnowledgeDocumentSnapshot } from "@propertyflow/contracts";

export type KnowledgeDocumentReadinessStatus = "ready" | "review" | "blocked";

export interface KnowledgeDocumentReadiness {
  label: string;
  missingSignals: string[];
  score: number;
  status: KnowledgeDocumentReadinessStatus;
  summary: string;
}

const minimumSearchableCharacters = 160;

export function assessKnowledgeDocumentReadiness(document: KnowledgeDocumentSnapshot): KnowledgeDocumentReadiness {
  const missingSignals: string[] = [];
  const body = document.body.trim();

  if (body.length < minimumSearchableCharacters) {
    missingSignals.push("more source text");
  }

  if (!document.tags.length) {
    missingSignals.push("retrieval tags");
  }

  if (!hasSourceReference(document)) {
    missingSignals.push("source reference");
  }

  const score = Math.max(0, 3 - missingSignals.length);

  if (score === 3) {
    return {
      label: "AI ready",
      missingSignals,
      score,
      status: "ready",
      summary: "Enough source text, tags, and provenance for Concierge answers."
    };
  }

  if (score >= 1) {
    return {
      label: "Review",
      missingSignals,
      score,
      status: "review",
      summary: `Improve ${formatMissingSignals(missingSignals)} before relying on this source.`
    };
  }

  return {
    label: "Blocked",
    missingSignals,
    score,
    status: "blocked",
    summary: "Add source text, tags, and provenance before this can reliably ground AI answers."
  };
}

function hasSourceReference(document: KnowledgeDocumentSnapshot) {
  return (
    document.body.includes("Source reference:") ||
    document.body.includes("Source upload:") ||
    document.tags.some((tag) => tag === "source-file" || tag === "source-url" || tag.startsWith("source-domain:"))
  );
}

function formatMissingSignals(signals: string[]) {
  if (!signals.length) {
    return "source quality";
  }

  if (signals.length === 1) {
    return signals[0];
  }

  return `${signals.slice(0, -1).join(", ")} and ${signals[signals.length - 1]}`;
}
