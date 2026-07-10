import type { ConciergeResponse } from "@propertyflow/contracts";

export const demoConciergeResponse: ConciergeResponse = {
  id: "demo-concierge-response",
  stage: "recommendation",
  profile: {
    market: "pattaya",
    budgetThb: 3500000,
    familySize: 3,
    hasChildren: true,
    hasCar: false,
    remoteWork: true,
    purpose: "living",
    prefersQuiet: true
  },
  nextQuestions: [],
  areaRecommendation: {
    area: "Wongamat",
    market: "pattaya",
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
    "For a family relocating to Pattaya with remote work needs, Wongamat is the strongest first area to inspect. It keeps beach access and rental demand without pushing you into the busiest tourist streets.",
  createdAt: "2026-07-09T08:00:00.000Z"
};
