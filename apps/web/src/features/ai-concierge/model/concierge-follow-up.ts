import type { ConciergeProfile, ConciergeQuestion } from "@propertyflow/contracts";

export type ConciergeFollowUpOption = {
  label: string;
  patch: ConciergeProfile;
};

export function buildFollowUpOptions(question: ConciergeQuestion, profile: ConciergeProfile): ConciergeFollowUpOption[] {
  if (question.id === "listingIntent") {
    return [
      { label: "Rent", patch: { listingIntent: "rent", purpose: "living" } },
      { label: "Buy", patch: { listingIntent: "sale" } },
      { label: "Compare both", patch: { listingIntent: "sale_or_rent" } }
    ];
  }

  if (question.id === "hasChildren") {
    return [
      { label: "Children will live here", patch: { hasChildren: true } },
      { label: "Adults only", patch: { hasChildren: false } }
    ];
  }

  if (question.id === "hasCar") {
    return [
      { label: "We will have a car", patch: { hasCar: true } },
      { label: "Walkability matters", patch: { hasCar: false } }
    ];
  }

  if (question.id === "remoteWork") {
    return [
      { label: "Remote work", patch: { remoteWork: true } },
      { label: "Internet is not critical", patch: { remoteWork: false } }
    ];
  }

  if (question.id === "purpose") {
    return [
      { label: "Living", patch: { purpose: "living" } },
      { label: "Relocation", patch: { purpose: "relocation" } },
      { label: "Investment", patch: { purpose: "investment" } }
    ];
  }

  if (question.id === "prefersQuiet") {
    return [
      { label: "Quiet area", patch: { prefersQuiet: true } },
      { label: "Lively is fine", patch: { prefersQuiet: false } }
    ];
  }

  if (question.id === "budgetThb") {
    return profile.listingIntent === "rent" ? rentalBudgetOptions : purchaseBudgetOptions;
  }

  if (question.id === "market") {
    return [
      { label: "Pattaya", patch: { market: "pattaya" } },
      { label: "Phuket", patch: { market: "phuket" } },
      { label: "Bangkok", patch: { market: "bangkok" } }
    ];
  }

  return [];
}

export function parseBudgetAnswer(value: string): number | undefined {
  const normalized = value.trim().toLowerCase().replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const millionMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|million|mln|млн)/);

  if (millionMatch?.[1]) {
    return Math.round(Number.parseFloat(millionMatch[1]) * 1_000_000);
  }

  const thousandMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:k|тыс)/);

  if (thousandMatch?.[1]) {
    return Math.round(Number.parseFloat(thousandMatch[1]) * 1_000);
  }

  const plainNumber = normalized.match(/\d{4,9}/)?.[0];

  return plainNumber ? Number.parseInt(plainNumber, 10) : undefined;
}

const rentalBudgetOptions: ConciergeFollowUpOption[] = [
  { label: "25k THB/month", patch: { budgetThb: 25000 } },
  { label: "40k THB/month", patch: { budgetThb: 40000 } },
  { label: "60k THB/month", patch: { budgetThb: 60000 } }
];

const purchaseBudgetOptions: ConciergeFollowUpOption[] = [
  { label: "3M THB", patch: { budgetThb: 3000000 } },
  { label: "5M THB", patch: { budgetThb: 5000000 } },
  { label: "8M THB", patch: { budgetThb: 8000000 } }
];
