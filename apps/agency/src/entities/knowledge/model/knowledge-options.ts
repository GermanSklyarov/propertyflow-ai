import type { KnowledgeDocumentKind, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";

export const knowledgeLocaleOptions: KnowledgeDocumentSnapshot["locale"][] = ["en", "ru", "th", "zh"];

export const knowledgeKindOptions: KnowledgeDocumentKind[] = [
  "article",
  "neighborhood",
  "relocation",
  "legal",
  "investment",
  "faq"
];
