import type { AiChatInsight } from "@propertyflow/contracts";

export type AiChatInsightTone = "info" | "warning" | "critical";

export function getAiChatInsightTone(insight: AiChatInsight): AiChatInsightTone {
  return insight.severity ?? "info";
}

export function getAiChatInsightKey(insight: AiChatInsight, index: number): string {
  return [insight.kind, insight.propertyId ?? "workspace", insight.title, index].join("-");
}
