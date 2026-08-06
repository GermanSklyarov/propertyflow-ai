import type { AiAdvisorSummary, AiChatInsight } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

export interface AiChatDueDiligencePayload {
  contextLines: string[];
  insights: AiChatInsight[];
}

export interface AiChatAdvisorSummarizer {
  summarize(tenantId: string, propertyId: string): Promise<AiAdvisorSummary>;
}

export async function buildAiChatDueDiligencePayload(
  tenantId: string,
  properties: PropertySnapshot[],
  advisor: AiChatAdvisorSummarizer
): Promise<AiChatDueDiligencePayload> {
  if (!properties.length) {
    return { contextLines: [], insights: [] };
  }

  return buildAiChatDueDiligencePayloadFromSummaries(
    await Promise.all(
      properties.map(async (property) => ({
        property,
        summary: await advisor.summarize(tenantId, property.id)
      }))
    )
  );
}

export function buildAiChatDueDiligencePayloadFromSummaries(
  summaries: Array<{ property: PropertySnapshot; summary: AiAdvisorSummary }>
): AiChatDueDiligencePayload {
  if (!summaries.length) {
    return { contextLines: [], insights: [] };
  }

  return {
    contextLines: [
      "Structured due diligence context for risks and watch-outs. Treat these as tenant-data-backed signals or checks to verify, not as legal advice or confirmed defects:",
      ...summaries.map(({ property, summary }) => buildPropertyDueDiligenceLine(property, summary))
    ],
    insights: summaries.flatMap(({ property, summary }) => buildPropertyInsights(property, summary))
  };
}

export function buildPropertyInsights(property: PropertySnapshot, summary: AiAdvisorSummary): AiChatInsight[] {
  const insights: AiChatInsight[] = [];

  if (summary.bestFor.length) {
    insights.push({
      kind: "fit",
      title: `${property.title} fit`,
      detail: `Best suited for ${summary.bestFor.join(", ")} based on current listing signals.`,
      propertyId: property.id,
      severity: "info"
    });
  }

  for (const risk of summary.risks.slice(0, 2)) {
    insights.push({
      kind: "risk",
      title: `${property.title} risk check`,
      detail: risk,
      propertyId: property.id,
      severity: "warning"
    });
  }

  for (const question of summary.questionsToAskAgent.slice(0, 2)) {
    insights.push({
      kind: "due_diligence",
      title: "Ask before recommending",
      detail: question,
      propertyId: property.id,
      severity: "info"
    });
  }

  return insights;
}

function buildPropertyDueDiligenceLine(property: PropertySnapshot, summary: AiAdvisorSummary): string {
  const signals = [
    summary.cons.length ? `watch-outs: ${summary.cons.join(" ")}` : undefined,
    summary.risks.length ? `data gaps/risks: ${summary.risks.join(" ")}` : undefined,
    summary.questionsToAskAgent.length ? `verification questions: ${summary.questionsToAskAgent.join(" ")}` : undefined
  ].filter(Boolean);

  return `${property.title}: ${signals.length ? signals.join(" ") : "no material watch-outs were detected from structured fields."}`;
}
