import type { ConciergeProfile, ConciergeQuestion, ConciergeRequest, ConciergeResponse } from "@propertyflow/contracts";

const demoCreatedAt = "2026-07-09T08:00:00.000Z";

export const demoConciergeResponse: ConciergeResponse = buildDemoConciergeResponse({
  locale: "en",
  message: "Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB",
  profile: {
    market: "pattaya",
    listingIntent: "sale",
    budgetThb: 3500000,
    familySize: 3,
    hasChildren: true,
    hasCar: false,
    remoteWork: true,
    purpose: "living",
    prefersQuiet: true
  }
});

export function buildDemoConciergeResponse(request: ConciergeRequest): ConciergeResponse {
  const profile = request.profile ?? {};
  const nextQuestions = getDemoNextQuestions(profile);

  if (nextQuestions.length) {
    return {
      id: "demo-concierge-intake",
      stage: "intake",
      profile,
      nextQuestions,
      propertyRecommendations: [],
      summary: `I have enough to start with ${describeDemoProfile(profile)}. To recommend an area and listings more precisely, I need a few quick details.`,
      createdAt: demoCreatedAt
    };
  }

  return {
    id: "demo-concierge-response",
    stage: "recommendation",
    profile,
    nextQuestions: [],
    areaRecommendation: {
      area: profile.hasChildren && profile.prefersQuiet ? "Wongamat" : "Pratumnak",
      market: profile.market ?? "pattaya",
      fit: "strong",
      reasons: ["quiet beach access", "better winter rental demand", "good balance of cafes and residential calm"],
      tradeoffs: ["less nightlife than Central Pattaya", "newer buildings can have higher maintenance fees"]
    },
    propertyRecommendations: [
      {
        propertyId: "demo-wongamat-sky",
        title: "Wongamat Sky Residence",
        score: 91,
        fit: "strong",
        reasons: ["near the beach", "fiber internet", "quiet enough for remote work"],
        tradeoffs: ["west-facing units need heat check"]
      },
      {
        propertyId: "demo-terminal-north",
        title: "Terminal North City Condo",
        score: 78,
        fit: "moderate",
        reasons: ["shopping and transport are easy", "good liquidity for resale"],
        tradeoffs: ["busier streets", "less family-friendly at night"]
      }
    ],
    summary:
      "For this Pattaya search, I would start with a calm coastal area and then compare the strongest listing fit against walkability and daily-life tradeoffs.",
    createdAt: demoCreatedAt
  };
}

function getDemoNextQuestions(profile: ConciergeProfile): ConciergeQuestion[] {
  return [
    !profile.listingIntent
      ? {
          id: "listingIntent",
          question: "Do you want to rent, buy, or compare both paths?",
          reason: "This keeps monthly rent and purchase budgets from getting mixed."
        }
      : undefined,
    !profile.budgetThb
      ? {
          id: "budgetThb",
          question:
            profile.listingIntent === "rent"
              ? "What monthly rent budget in THB should I stay under?"
              : "What purchase budget in THB should I stay under?",
          reason: "Budget keeps recommendations realistic."
        }
      : undefined,
    profile.hasChildren === undefined
      ? {
          id: "hasChildren",
          question: "Will children live with you?",
          reason: "Children change priorities around space, quiet, and schools."
        }
      : undefined,
    profile.hasCar === undefined
      ? {
          id: "hasCar",
          question: "Will you have a car, or should walkability matter more?",
          reason: "Without a car, the area needs stronger daily walkability."
        }
      : undefined,
    profile.remoteWork === undefined
      ? {
          id: "remoteWork",
          question: "Will you work remotely and need strong internet?",
          reason: "Remote work makes internet, noise, and cafes/coworking more important."
        }
      : undefined,
    !profile.purpose
      ? {
          id: "purpose",
          question: "Is this mainly for living, relocation, or investment?",
          reason: "Living and investment use different scoring criteria."
        }
      : undefined,
    profile.prefersQuiet === undefined
      ? {
          id: "prefersQuiet",
          question: "Do you prefer quiet, or is a busier tourist area fine?",
          reason: "This prevents recommending the wrong neighborhood mood."
        }
      : undefined
  ].filter((question): question is ConciergeQuestion => Boolean(question)).slice(0, 4);
}

function describeDemoProfile(profile: ConciergeProfile) {
  return [
    profile.market ? `${profile.market} market` : undefined,
    profile.listingIntent ? `${profile.listingIntent === "rent" ? "rental" : "purchase"} intent` : undefined,
    profile.budgetThb ? `budget up to ${formatDemoThb(profile.budgetThb)}` : undefined,
    profile.purpose ? `${profile.purpose} goal` : undefined,
    profile.remoteWork ? "remote work matters" : undefined
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDemoThb(amount: number) {
  if (amount >= 1_000_000) {
    return `${Number.parseFloat((amount / 1_000_000).toFixed(1))}M THB`;
  }

  return `${Math.round(amount / 1_000)}k THB`;
}
