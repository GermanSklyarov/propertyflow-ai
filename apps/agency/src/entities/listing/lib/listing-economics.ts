import type { PropertySnapshot } from "@propertyflow/domain";
import { formatPercent } from "@shared/lib/formatters";
import { formatCompactListingMoney, formatListingMoney } from "./listing-formatters";

export function buildListingEconomics(listing: PropertySnapshot) {
  const rent = listing.monthlyRentEstimate ?? listing.rentalPriceMonthly;
  const grossYield = rent && listing.price.amount > 0 ? (rent.amount * 12) / listing.price.amount : undefined;

  return {
    annualRentValue: rent ? formatListingMoney({ ...rent, amount: rent.amount * 12 }) : "not estimated",
    grossYieldValue: grossYield ? formatPercent(grossYield, { maximumFractionDigits: 1 }) : "not enough data",
    maintenanceValue: listing.maintenanceFeeMonthly ? `${formatListingMoney(listing.maintenanceFeeMonthly)}/mo` : "not set",
    pricePerSqm: listing.areaSqm > 0 ? formatListingMoney({ ...listing.price, amount: listing.price.amount / listing.areaSqm }) : "not set",
    rentNote: listing.rentalPriceMonthly ? "Listed monthly rent" : rent ? "AI rent estimate" : "Needs rent signal",
    rentValue: rent ? `${formatCompactListingMoney(rent)}/mo` : "not set",
    yieldQuality: grossYield ? getYieldQuality(grossYield) : "needs rent estimate"
  };
}

function getYieldQuality(grossYield: number) {
  if (grossYield >= 0.07) {
    return "strong investment signal";
  }

  if (grossYield >= 0.05) {
    return "market-normal signal";
  }

  return "lifestyle-led case";
}
