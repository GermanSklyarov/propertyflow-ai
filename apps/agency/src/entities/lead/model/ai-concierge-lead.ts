import type { LeadSnapshot } from "@propertyflow/contracts";

export interface AiConciergeLeadContext {
  conversation: Array<{ role: "assistant" | "user"; text: string }>;
  recommendedListings: Array<{ propertyId: string; title: string }>;
  visitorNote?: string;
}

export function parseAiConciergeLeadContext(lead: LeadSnapshot): AiConciergeLeadContext | null {
  if (lead.source !== "ai-concierge" || !lead.message?.includes("Widget handoff request.")) {
    return null;
  }

  const sections = splitLeadSections(lead.message);
  const visitorNote = parseVisitorNote(sections);
  const recommendedListings = parseRecommendedListings(sections);
  const conversation = parseConversation(sections);

  if (!visitorNote && !recommendedListings.length && !conversation.length) {
    return null;
  }

  return {
    conversation,
    recommendedListings,
    visitorNote
  };
}

function splitLeadSections(message: string): string[] {
  return message
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function parseVisitorNote(sections: string[]): string | undefined {
  const section = sections.find((item) => item.startsWith("Visitor note:"));
  const value = section?.replace(/^Visitor note:\s*/, "").trim();

  return value || undefined;
}

function parseRecommendedListings(sections: string[]): AiConciergeLeadContext["recommendedListings"] {
  const section = sections.find((item) => item.startsWith("Recommended listings:"));

  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .slice(1)
    .map(parseListingLine)
    .filter((listing): listing is { propertyId: string; title: string } => Boolean(listing))
    .slice(0, 3);
}

function parseConversation(sections: string[]): AiConciergeLeadContext["conversation"] {
  const section = sections.find((item) => item.startsWith("Recent widget conversation:"));

  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .slice(1)
    .filter((line) => !line.startsWith("Shown listings:") && !parseListingLine(line))
    .map((line) => {
      const match = line.match(/^(assistant|user):\s*(.+)$/);

      return match?.[1] && match[2]
        ? {
            role: match[1] as "assistant" | "user",
            text: match[2].trim()
          }
        : null;
    })
    .filter((turn): turn is { role: "assistant" | "user"; text: string } => Boolean(turn))
    .slice(-6);
}

function parseListingLine(line: string): { propertyId: string; title: string } | null {
  const match = line.match(/^\d+\.\s+(.+?)\s+\(([^)]+)\)$/);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    propertyId: match[2].trim(),
    title: match[1].trim()
  };
}
