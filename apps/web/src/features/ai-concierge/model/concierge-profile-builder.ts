import type { ConciergeProfile, ConciergeRequest } from "@propertyflow/contracts";

export type ConciergeProfileChip = {
  label: string;
  value: string;
};

export function buildConciergeRequest(message: string): ConciergeRequest {
  return {
    locale: "en",
    message,
    profile: buildConciergeProfile(message)
  };
}

export function buildConciergeProfile(message: string): ConciergeProfile {
  const normalized = message.toLowerCase();
  const profile: ConciergeProfile = {
    market: detectMarket(normalized) ?? "pattaya"
  };
  const budgetThb = detectBudgetThb(normalized);
  const purpose = detectPurpose(normalized);

  if (budgetThb) {
    profile.budgetThb = budgetThb;
  }

  if (purpose) {
    profile.purpose = purpose;
  }

  if (mentionsAny(normalized, ["family", "children", "kids", "school", "семь", "дет", "школ"])) {
    profile.hasChildren = true;
    profile.purpose = profile.purpose ?? "family";
  }

  if (mentionsAny(normalized, ["remote", "work from home", "internet", "wifi", "wi-fi", "удален", "интернет"])) {
    profile.remoteWork = true;
  }

  if (mentionsAny(normalized, ["quiet", "calm", "тих", "спокой"])) {
    profile.prefersQuiet = true;
  }

  if (mentionsAny(normalized, ["car", "parking", "машин", "парков"])) {
    profile.hasCar = true;
  }

  return profile;
}

export function buildConciergeProfileChips(profile: ConciergeProfile): ConciergeProfileChip[] {
  return [
    profile.market ? { label: "Market", value: profile.market } : undefined,
    profile.budgetThb ? { label: "Budget", value: formatBudget(profile.budgetThb) } : undefined,
    profile.purpose ? { label: "Purpose", value: profile.purpose } : undefined,
    profile.hasChildren ? { label: "Family", value: "children" } : undefined,
    profile.remoteWork ? { label: "Work", value: "remote" } : undefined,
    profile.prefersQuiet ? { label: "Area", value: "quiet" } : undefined,
    profile.hasCar ? { label: "Mobility", value: "car" } : undefined
  ].filter((chip): chip is ConciergeProfileChip => Boolean(chip));
}

function detectMarket(normalizedMessage: string): ConciergeProfile["market"] | undefined {
  if (mentionsAny(normalizedMessage, ["pattaya", "паттай"])) {
    return "pattaya";
  }

  if (mentionsAny(normalizedMessage, ["phuket", "пхукет"])) {
    return "phuket";
  }

  if (mentionsAny(normalizedMessage, ["bangkok", "банкок", "бангкок"])) {
    return "bangkok";
  }

  if (mentionsAny(normalizedMessage, ["samui", "самуи"])) {
    return "koh-samui";
  }

  if (mentionsAny(normalizedMessage, ["hua hin", "хуахин", "хуа хин"])) {
    return "hua-hin";
  }

  return undefined;
}

function detectPurpose(normalizedMessage: string): ConciergeProfile["purpose"] | undefined {
  if (mentionsAny(normalizedMessage, ["invest", "yield", "roi", "rent out", "сдач", "доход", "инвест"])) {
    return "investment";
  }

  if (mentionsAny(normalizedMessage, ["relocat", "move", "moving", "переезд", "переезж"])) {
    return "relocation";
  }

  if (mentionsAny(normalizedMessage, ["family", "children", "kids", "семь", "дет"])) {
    return "family";
  }

  if (mentionsAny(normalizedMessage, ["living", "live", "winter", "жить", "зим"])) {
    return "living";
  }

  return undefined;
}

function detectBudgetThb(normalizedMessage: string) {
  const millionMatch = normalizedMessage.match(/(\d+(?:[.,]\d+)?)\s*(?:m(?![a-z])|million|mln|млн)/i);

  if (millionMatch?.[1]) {
    return Math.round(Number.parseFloat(millionMatch[1].replace(",", ".")) * 1_000_000);
  }

  const thousandMatch = normalizedMessage.match(/(\d+(?:[.,]\d+)?)\s*(?:k|тыс)/i);

  if (thousandMatch?.[1]) {
    return Math.round(Number.parseFloat(thousandMatch[1].replace(",", ".")) * 1_000);
  }

  const thbMatch = normalizedMessage.match(/(?:under|до|budget|бюджет)?\s*(\d{4,8})\s*(?:thb|бат|baht)?/i);

  if (thbMatch?.[1]) {
    return Number.parseInt(thbMatch[1], 10);
  }

  return undefined;
}

function formatBudget(amount: number) {
  if (amount >= 1_000_000) {
    return `${Number.parseFloat((amount / 1_000_000).toFixed(1))}M THB`;
  }

  return `${Math.round(amount / 1_000)}k THB`;
}

function mentionsAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}
