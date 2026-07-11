import type { PropertySnapshot } from "@propertyflow/domain";
import type { LeadIntent } from "./lead-capture-schema";

export type LeadIntentOption = {
  label: string;
  value: LeadIntent;
};

export const leadIntentOptions: LeadIntentOption[] = [
  { value: "viewing", label: "Viewing" },
  { value: "rental", label: "Rent terms" },
  { value: "investment", label: "ROI check" }
];

export function getFallbackLeadIntent(property: PropertySnapshot): LeadIntent {
  return property.listingType === "rent" ? "rental" : "viewing";
}

export function getLeadActionLabel(intent: LeadIntent) {
  if (intent === "rental") {
    return "Request rent terms";
  }

  if (intent === "investment") {
    return "Request ROI review";
  }

  return "Request viewing";
}

export function getDefaultLeadMessage(property: PropertySnapshot, intent: LeadIntent) {
  if (intent === "rental") {
    return `I want to discuss rent terms for ${property.title}, including lease length, deposit, and utilities.`;
  }

  if (intent === "investment") {
    return `Please review the ROI, rent estimate, fees, and resale liquidity for ${property.title}.`;
  }

  return `I would like to schedule a viewing or video tour for ${property.title}.`;
}
