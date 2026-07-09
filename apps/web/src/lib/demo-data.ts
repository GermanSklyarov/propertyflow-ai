import type { ConciergeResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

export const demoProperties: PropertySnapshot[] = [
  {
    id: "demo-wongamat-sky",
    tenantId: "demo-agency",
    title: "Wongamat Sky Residence",
    description:
      "A high-floor sea-view condo near Wongamat beach with fiber internet, quiet surroundings, and strong winter rental demand.",
    kind: "condo",
    market: "pattaya",
    status: "available",
    price: { amount: 3250000, currency: "THB" },
    location: { latitude: 12.9606, longitude: 100.8875 },
    address: "Wongamat, Pattaya",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 44,
    floor: 22,
    beachDistanceMeters: 350,
    monthlyRentEstimate: { amount: 21000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 2200, currency: "THB" },
    amenities: ["sea view", "pool", "gym", "fiber internet", "covered parking"],
    createdAt: "2026-01-14T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z"
  },
  {
    id: "demo-terminal-north",
    tenantId: "demo-agency",
    title: "Terminal North City Condo",
    description:
      "Compact city condo within walking distance of Terminal 21, restaurants, shopping, and transport links.",
    kind: "condo",
    market: "pattaya",
    status: "available",
    price: { amount: 2850000, currency: "THB" },
    location: { latitude: 12.9478, longitude: 100.8892 },
    address: "North Pattaya",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 36,
    floor: 11,
    beachDistanceMeters: 900,
    monthlyRentEstimate: { amount: 17500, currency: "THB" },
    maintenanceFeeMonthly: { amount: 1800, currency: "THB" },
    amenities: ["city view", "pool", "coworking lounge", "gym"],
    createdAt: "2026-02-10T08:00:00.000Z",
    updatedAt: "2026-06-28T08:00:00.000Z"
  },
  {
    id: "demo-jomtien-family",
    tenantId: "demo-agency",
    title: "Jomtien Family Garden",
    description:
      "Two-bedroom condo with a calmer neighborhood profile, large pool, nearby cafes, and easy beach access.",
    kind: "condo",
    market: "pattaya",
    status: "available",
    price: { amount: 4600000, currency: "THB" },
    location: { latitude: 12.8976, longitude: 100.8758 },
    address: "Jomtien, Pattaya",
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 68,
    floor: 7,
    beachDistanceMeters: 520,
    monthlyRentEstimate: { amount: 28000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 3400, currency: "THB" },
    amenities: ["family pool", "garden", "playground", "balcony", "parking"],
    createdAt: "2026-03-03T08:00:00.000Z",
    updatedAt: "2026-06-20T08:00:00.000Z"
  }
];

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
