import type { ConciergeProfile, ConciergeResponse } from "@propertyflow/contracts";

export const conciergeConsoleStorageKey = "propertyflow:concierge-console:v1";

export type ConciergeConsoleStorageState = {
  budgetAnswer: string;
  message: string;
  profileOverride: ConciergeProfile;
  response: ConciergeResponse | null;
};

export function stringifyConciergeConsoleState(state: ConciergeConsoleStorageState) {
  return JSON.stringify(state);
}

export function parseConciergeConsoleState(rawState: string | null): ConciergeConsoleStorageState | null {
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as Partial<ConciergeConsoleStorageState>;

    if (!parsed || typeof parsed !== "object" || typeof parsed.message !== "string") {
      return null;
    }

    return {
      budgetAnswer: typeof parsed.budgetAnswer === "string" ? parsed.budgetAnswer : "",
      message: parsed.message,
      profileOverride: isRecord(parsed.profileOverride) ? parsed.profileOverride : {},
      response: isConciergeResponse(parsed.response) ? parsed.response : null
    };
  } catch {
    return null;
  }
}

function isConciergeResponse(value: unknown): value is ConciergeResponse {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.stage === "intake" || value.stage === "recommendation") &&
    Array.isArray(value.nextQuestions) &&
    Array.isArray(value.propertyRecommendations) &&
    typeof value.summary === "string" &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
